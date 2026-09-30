module.exports = function createCheckoutHandler(admin, functions, helpers = {}) {
  const db = admin.firestore();
  const sendShopBadge = helpers.sendShopBadge || (async () => {});

  return async function checkoutOrder(data, context) {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const customerUid = context.auth.uid;

    const {
      idempotency_key,
      group_id,
      orders: rawOrders,
      customer_name,
      customer_phone,
      customer_avatar,
      delivery_address,
      location,
      payment_method,
      cash_change_note,
    } = data || {};

    if (!idempotency_key || typeof idempotency_key !== 'string' || idempotency_key.trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid idempotency_key');
    }

    if (!Array.isArray(rawOrders) || rawOrders.length === 0 || rawOrders.length > 20) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid orders list');
    }

    const cleanPhone = (customer_phone || '').replace(/[-\s]/g, '');
    if (!/^0[0-9]{9}$/.test(cleanPhone)) {
      throw new functions.https.HttpsError('invalid-argument', 'กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ติดต่อได้ก่อนทำการสั่งซื้อ (ป้องกันออเดอร์แอบอ้าง)');
    }

    const trimmedKey = idempotency_key.trim();
    const reqRef = db.collection('_checkout_requests').doc(trimmedKey);

    async function replayCheckout(reqData) {
      if (reqData.customer_uid !== customerUid) {
        throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user');
      }
      const orderDocs = await Promise.all(
        (reqData.order_ids || []).map(id => db.collection('orders').doc(id).get())
      );
      const orders = orderDocs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
      return {
        success: true,
        alreadyProcessed: true,
        orderIds: reqData.order_ids || [],
        orders,
        groupId: reqData.group_id,
      };
    }

    // 1. Check idempotency before transaction
    const existingReq = await reqRef.get();
    if (existingReq.exists) return replayCheckout(existingReq.data());

    // 2. Process checkout transaction
    const bundleGroupId = group_id || `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const result = await db.runTransaction(async (tx) => {
      // Re-verify idempotency inside transaction
      const txReqSnap = await tx.get(reqRef);
      if (txReqSnap.exists) {
        const request = txReqSnap.data();
        if (request.customer_uid !== customerUid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user');
        }
        return { request };
      }
      // Callback attempts may be retried; only return the committed attempt's data.
      const createdOrdersList = [];
      const shopIdsToNotify = [];

      // Read system_settings/general
      const generalSettingsRef = db.collection('system_settings').doc('general');
      const generalSettingsSnap = await tx.get(generalSettingsRef);
      const generalSettings = generalSettingsSnap.exists ? generalSettingsSnap.data() : {};

      const gpEnabled = generalSettings.gp_enabled === true || String(generalSettings.gp_enabled) === 'true';
      const gpPercent = typeof generalSettings.gp_percent === 'number' ? generalSettings.gp_percent : (parseFloat(generalSettings.gp_percent) || 5);
      const defaultDeliveryFee = typeof generalSettings.delivery_fee === 'number' ? generalSettings.delivery_fee : 10;

      // Read system_settings/order_counter
      const counterRef = db.collection('system_settings').doc('order_counter');
      const counterSnap = await tx.get(counterRef);
      const currentCounter = counterSnap.exists ? counterSnap.data().last_order_number : 1000;
      if (!Number.isSafeInteger(currentCounter) || currentCounter < 1000) {
        throw new functions.https.HttpsError('failed-precondition', 'Invalid order counter');
      }

      // Verify unique shops
      const uniqueShopIds = [...new Set(rawOrders.map(o => o.shop_id).filter(Boolean))];
      if (uniqueShopIds.length !== rawOrders.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Duplicate shops in order requests');
      }

      // Verify caller is not ordering from their own shop
      const callerAccessRef = db.collection('access').doc(customerUid);
      const callerUserRef = db.collection('users').doc(customerUid);
      const [callerAccessSnap, callerUserSnap] = await Promise.all([
        tx.get(callerAccessRef),
        tx.get(callerUserRef)
      ]);
      const callerShopId = (callerAccessSnap.exists && callerAccessSnap.data().role === 'merchant' && callerAccessSnap.data().shop_id)
        || (callerUserSnap.exists && callerUserSnap.data().role === 'merchant' && callerUserSnap.data().shop_id)
        || null;

      if (callerShopId && uniqueShopIds.includes(callerShopId)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'คุณไม่สามารถสั่งอาหารจากร้านของตนเองได้ (คุณยังสามารถสั่งอาหารจากร้านอื่นได้ตามปกติครับ)'
        );
      }

      // Read all shops
      const shopSnaps = new Map();
      for (const shopId of uniqueShopIds) {
        const sRef = db.collection('shops').doc(shopId);
        const sSnap = await tx.get(sRef);
        if (!sSnap.exists) {
          throw new functions.https.HttpsError('not-found', `Shop not found: ${shopId}`);
        }
        shopSnaps.set(shopId, sSnap.data());
      }

      // Collect all menu_items to read
      const allMenuIds = [];
      for (const orderReq of rawOrders) {
        if (!Array.isArray(orderReq.items) || orderReq.items.length === 0 || orderReq.items.length > 50) {
          throw new functions.https.HttpsError('invalid-argument', 'Invalid items in shop order');
        }
        for (const item of orderReq.items) {
          if (!item.menu_id || typeof item.menu_id !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid menu_id');
          }
          const qty = parseInt(item.quantity, 10);
          if (!Number.isInteger(qty) || qty <= 0 || qty > 100) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid item quantity');
          }
          allMenuIds.push(item.menu_id);
        }
      }

      const menuSnaps = new Map();
      for (const menuId of [...new Set(allMenuIds)]) {
        const mRef = db.collection('menu_items').doc(menuId);
        const mSnap = await tx.get(mRef);
        if (!mSnap.exists) {
          throw new functions.https.HttpsError('not-found', `Menu item not found: ${menuId}`);
        }
        menuSnaps.set(menuId, mSnap.data());
      }

      // Calculate authoritative prices & build order documents
      let nextOrderNum = currentCounter;
      const orderDocsToWrite = [];

      for (const orderReq of rawOrders) {
        const shopId = orderReq.shop_id;
        const shopData = shopSnaps.get(shopId);

        if (shopData.is_open === false) {
          throw new functions.https.HttpsError('failed-precondition', `ร้าน ${shopData.name || shopId} ปิดให้บริการอยู่ในขณะนี้`);
        }

        if (gpEnabled) {
          const creditBal = typeof shopData.credit_balance === 'number' ? shopData.credit_balance : 0;
          if (creditBal <= 0) {
            throw new functions.https.HttpsError('failed-precondition', `ร้าน ${shopData.name || shopId} ไม่พร้อมรับออเดอร์ (เครดิตไม่เพียงพอ)`);
          }
        }

        let shopFoodSubtotal = 0;
        const verifiedItems = [];

        for (const rawItem of orderReq.items) {
          const menuData = menuSnaps.get(rawItem.menu_id);
          if (menuData.shop_id !== shopId) {
            throw new functions.https.HttpsError('invalid-argument', `Menu item ${rawItem.menu_id} does not belong to shop ${shopId}`);
          }
          if (menuData.is_available === false) {
            throw new functions.https.HttpsError('failed-precondition', `เมนู "${menuData.name}" หมดชั่วคราว`);
          }

          const basePrice = typeof menuData.price === 'number' ? menuData.price : (parseFloat(menuData.price) || 0);
          if (basePrice < 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Invalid menu price');
          }

          let itemUnitPrice = basePrice;
          const verifiedOptions = [];

          if (rawItem.selected_options != null && !Array.isArray(rawItem.selected_options)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid selected options');
          }

          const rawOptions = Array.isArray(rawItem.selected_options) ? rawItem.selected_options : [];
          const hasOptionGroups = Array.isArray(menuData.option_groups) && menuData.option_groups.length > 0;

          if (hasOptionGroups) {
            // Track which options matched which group
            const groupSelections = new Map();
            for (const grp of menuData.option_groups) {
              if (grp && grp.id) groupSelections.set(grp.id, []);
            }

            for (const opt of rawOptions) {
              if (!opt || typeof opt.name !== 'string') {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid selected option');
              }

              let matchedGroup = null;
              let matchedOption = null;

              // 1. Match by explicit group_id or group_title
              if (opt.group_id) {
                matchedGroup = menuData.option_groups.find(g => g && g.id === opt.group_id);
              }
              if (!matchedGroup && opt.group_title) {
                matchedGroup = menuData.option_groups.find(g => g && (g.title === opt.group_title || g.name === opt.group_title));
              }

              // 2. If matched to a specific group, look inside that group
              if (matchedGroup && Array.isArray(matchedGroup.options)) {
                if (opt.option_id) {
                  matchedOption = matchedGroup.options.find(o => o && o.id === opt.option_id);
                }
                if (!matchedOption) {
                  matchedOption = matchedGroup.options.find(o => o && o.name === opt.name);
                }
              }

              // 3. Fallback matching across all groups if no group was specified
              if (!matchedOption) {
                for (const grp of menuData.option_groups) {
                  if (grp && Array.isArray(grp.options)) {
                    const found = grp.options.find(o => o && o.name === opt.name);
                    if (found) {
                      matchedGroup = grp;
                      matchedOption = found;
                      break;
                    }
                  }
                }
              }

              // 4. Fallback to legacy menu options if any
              if (!matchedOption && Array.isArray(menuData.options)) {
                matchedOption = menuData.options.find(o => o && o.name === opt.name);
              }

              if (!matchedOption) {
                throw new functions.https.HttpsError('invalid-argument', `ตัวเลือกอาหาร "${opt.name}" ไม่มีในเมนูแล้ว กรุณาเลือกอาหารใหม่`);
              }

              if (!Number.isFinite(matchedOption.price) || matchedOption.price < 0) {
                throw new functions.https.HttpsError('failed-precondition', 'Invalid menu option price');
              }

              if (matchedGroup && matchedGroup.id) {
                const list = groupSelections.get(matchedGroup.id) || [];
                list.push(matchedOption);
                groupSelections.set(matchedGroup.id, list);
              }

              verifiedOptions.push({
                name: matchedOption.name,
                price: matchedOption.price,
                group_id: matchedGroup ? matchedGroup.id : undefined,
                group_title: matchedGroup ? (matchedGroup.title || matchedGroup.name) : undefined,
              });
              itemUnitPrice += matchedOption.price;
            }

            // Validate group constraints (required, single vs multiple, max)
            for (const grp of menuData.option_groups) {
              if (!grp) continue;
              const selections = groupSelections.get(grp.id) || [];
              const groupLabel = grp.title || grp.name || 'ตัวเลือก';

              if (grp.required === true) {
                const minReq = typeof grp.min_select === 'number' ? grp.min_select : 1;
                if (selections.length < minReq) {
                  throw new functions.https.HttpsError('invalid-argument', `กรุณาเลือก "${groupLabel}" ให้ครบถ้วน`);
                }
              }

              if (grp.type === 'single' && selections.length > 1) {
                throw new functions.https.HttpsError('invalid-argument', `ตัวเลือก "${groupLabel}" สามารถเลือกได้เพียง 1 รายการ`);
              }

              if (typeof grp.max_select === 'number' && grp.max_select > 0 && selections.length > grp.max_select) {
                throw new functions.https.HttpsError('invalid-argument', `ตัวเลือก "${groupLabel}" สามารถเลือกได้ไม่เกิน ${grp.max_select} รายการ`);
              }
            }
          } else if (Array.isArray(menuData.options) && menuData.options.length > 0) {
            // Legacy menu options without groups
            const availableOptions = menuData.options;
            for (const opt of rawOptions) {
              if (!opt || typeof opt.name !== 'string') {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid selected option');
              }
              const matched = availableOptions.find(o => o && o.name === opt.name);
              if (!matched) {
                throw new functions.https.HttpsError('invalid-argument', `ตัวเลือกอาหาร "${opt.name}" ไม่มีในเมนูแล้ว กรุณาเลือกอาหารใหม่`);
              }
              if (!Number.isFinite(matched.price) || matched.price < 0) {
                throw new functions.https.HttpsError('failed-precondition', 'Invalid menu option price');
              }
              verifiedOptions.push({ name: matched.name, price: matched.price });
              itemUnitPrice += matched.price;
            }
          } else {
            // Menu has no options; ensure client didn't inject extra options
            if (rawOptions.length > 0) {
              throw new functions.https.HttpsError('invalid-argument', 'เมนูนี้ไม่มีตัวเลือกเพิ่มเติม');
            }
          }

          const qty = parseInt(rawItem.quantity, 10);
          const itemSubtotal = itemUnitPrice * qty;
          shopFoodSubtotal += itemSubtotal;

          verifiedItems.push({
            menu_id: rawItem.menu_id,
            name: menuData.name || '',
            price: itemUnitPrice,
            unit_price: basePrice,
            quantity: qty,
            selected_options: verifiedOptions,
            note: typeof rawItem.note === 'string' ? rawItem.note.slice(0, 200) : '',
            shop_id: shopId,
            shop_name: shopData.name || '',
            shop_phone: shopData.phone || '',
          });
        }

        const shopDeliveryFee = typeof shopData.delivery_fee === 'number' && shopData.delivery_fee >= 0
          ? shopData.delivery_fee
          : 0;
        const deliveryFee = shopDeliveryFee;
        const totalAmount = shopFoodSubtotal + deliveryFee;
        const gpAmount = gpEnabled ? Math.round(shopFoodSubtotal * (gpPercent / 100) * 100) / 100 : 0;

        nextOrderNum += 1;
        const assignedOrderNum = nextOrderNum;

        // Auto-generate initial payment info & QR code message if shop has payment details
        const hasPaymentInfo = Boolean(
          (shopData.bank_name && String(shopData.bank_name).trim()) ||
          (shopData.bank_account_number && String(shopData.bank_account_number).trim()) ||
          (shopData.promptpay_number && String(shopData.promptpay_number).trim()) ||
          (shopData.promptpay_qr_url && String(shopData.promptpay_qr_url).trim())
        );

        const orderRef = db.collection('orders').doc();
        let initialMessage = null;

        if (hasPaymentInfo) {
          const lines = [
            `💳 ข้อมูลชำระเงินสำหรับออเดอร์ #${assignedOrderNum}`,
            `💵 ยอดรวมที่ต้องชำระ: ฿${totalAmount}`,
          ];
          if (shopData.bank_name && String(shopData.bank_name).trim()) {
            lines.push(`🏦 ธนาคาร: ${String(shopData.bank_name).trim()}`);
          }
          if (shopData.bank_account_number && String(shopData.bank_account_number).trim()) {
            lines.push(`🔢 เลขที่บัญชี: ${String(shopData.bank_account_number).trim()}`);
          }
          if (shopData.bank_account_name && String(shopData.bank_account_name).trim()) {
            lines.push(`👤 ชื่อบัญชี: ${String(shopData.bank_account_name).trim()}`);
          }
          if (shopData.promptpay_number && String(shopData.promptpay_number).trim()) {
            lines.push(`📱 พร้อมเพย์: ${String(shopData.promptpay_number).trim()}`);
          }
          lines.push(`\n📌 เมื่อโอนเงินแล้ว กรุณากดปุ่ม 📸 แนบสลิปส่งในแชทนี้ เพื่อให้ร้านค้าเริ่มปรุงอาหารครับ`);

          const msgRef = orderRef.collection('messages').doc();
          initialMessage = {
            ref: msgRef,
            data: {
              order_id: orderRef.id,
              sender_uid: shopId,
              sender_name: shopData.name || 'ร้านค้า',
              sender_role: 'merchant',
              sender_avatar: shopData.image_url || '',
              text: lines.join('\n'),
              image_url: shopData.promptpay_qr_url ? String(shopData.promptpay_qr_url).trim() : '',
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              is_read: false,
            },
          };
        }

        const orderData = {
          order_number: assignedOrderNum,
          order_code: String(assignedOrderNum),
          group_id: bundleGroupId,
          shop_id: shopId,
          shop_name: shopData.name || '',
          shop_image: shopData.image_url || '',
          shop_phone: shopData.phone || '',
          customer_uid: customerUid,
          customer_name: (orderReq.customer_name || customer_name || '').trim(),
          customer_avatar: orderReq.customer_avatar || customer_avatar || '',
          customer_phone: cleanPhone || (orderReq.customer_phone || customer_phone || '').trim(),
          delivery_address: (orderReq.delivery_address || delivery_address || '').trim(),
          location: orderReq.location || location || null,
          items: verifiedItems,
          food_subtotal: shopFoodSubtotal,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          gp_amount: gpAmount,
          payment_method: orderReq.payment_method || payment_method || 'transfer_chat',
          cash_change_note: (orderReq.payment_method || payment_method) === 'cash' ? (orderReq.cash_change_note || cash_change_note || '') : null,
          status: 'pending',
          last_message: hasPaymentInfo ? '💳 ข้อมูลชำระเงินและ QR Code' : null,
          last_message_sender: hasPaymentInfo ? 'merchant' : null,
          last_message_at: hasPaymentInfo ? admin.firestore.FieldValue.serverTimestamp() : null,
          has_unread_message: false,
          has_customer_unread_message: hasPaymentInfo ? true : false,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        orderDocsToWrite.push({ ref: orderRef, data: orderData, id: orderRef.id, shopId, initialMessage });
      }

      // WRITES PHASE
      // 1. Advance counter
      tx.set(counterRef, {
        last_order_number: nextOrderNum,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // 2. Write orders and initial payment messages
      const createdIds = [];
      for (const { ref, data, id, shopId, initialMessage } of orderDocsToWrite) {
        tx.set(ref, data);
        if (initialMessage) {
          tx.set(initialMessage.ref, initialMessage.data);
        }
        createdIds.push(id);
        createdOrdersList.push({ id, ...data });
        shopIdsToNotify.push(shopId);
      }

      // 3. Write idempotency record
      tx.set(reqRef, {
        customer_uid: customerUid,
        order_ids: createdIds,
        group_id: bundleGroupId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { orders: createdOrdersList, shopIds: shopIdsToNotify };
    });

    // Another request with this key may have committed while this one was running.
    if (result.request) return replayCheckout(result.request);

    // Post-transaction badge and push notifications
    for (const shopId of [...new Set(result.shopIds)]) {
      sendShopBadge(shopId).catch(err => console.warn('sendShopBadge error:', err));
    }

    if (typeof helpers.notifyShopNewOrders === 'function') {
      helpers.notifyShopNewOrders(result.orders).catch(err => console.warn('notifyShopNewOrders error:', err));
    }

    return {
      success: true,
      orderIds: result.orders.map(o => o.id),
      orders: result.orders,
      groupId: bundleGroupId,
    };
  };
};
