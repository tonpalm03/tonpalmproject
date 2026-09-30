# -*- coding: utf-8 -*-
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# 1. Register Thai Fonts from Windows
FONT_REGULAR = "Tahoma"
FONT_BOLD = "TahomaBold"

pdfmetrics.registerFont(TTFont(FONT_REGULAR, "C:/Windows/Fonts/tahoma.ttf"))
pdfmetrics.registerFont(TTFont(FONT_BOLD, "C:/Windows/Fonts/tahomabd.ttf"))

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.setFont(FONT_REGULAR, 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(40, 810, "huaychan — รายงานสรุปโครงงานระบบสั่งอาหารชุมชนห้วยชัน-นาฝาย & มรภ. ชัยภูมิ")
            self.drawRightString(555, 810, "เอกสารสรุปนำเสนออาจารย์")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(40, 802, 555, 802)

        # Footer (all pages)
        self.setFont(FONT_REGULAR, 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 28, "ระบบเปิดใช้งานจริงที่: https://huaychan.web.app | huaychan Hyperlocal Food Delivery")
        page_str = f"หน้า {self._pageNumber} จาก {page_count}"
        self.drawRightString(555, 28, page_str)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, 38, 555, 38)
        
        self.restoreState()

def create_project_summary_pdf(output_filename="huaychan_project_summary.pdf"):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=45,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    C_PRIMARY = colors.HexColor("#D97706")    # Amber 600
    C_SECONDARY = colors.HexColor("#EA580C")  # Orange 600
    C_DARK = colors.HexColor("#0F172A")       # Slate 900
    C_TEXT = colors.HexColor("#334155")       # Slate 700
    C_MUTED = colors.HexColor("#64748B")      # Slate 500
    C_LIGHT_BG = colors.HexColor("#F8FAFC")   # Slate 50
    C_ACCENT_BG = colors.HexColor("#FEF3C7")  # Amber 100
    C_BORDER = colors.HexColor("#E2E8F0")     # Slate 200
    C_SUCCESS = colors.HexColor("#059669")    # Emerald 600

    # Custom Paragraph Styles
    style_cover_title = ParagraphStyle(
        'CoverTitle',
        fontName=FONT_BOLD,
        fontSize=20,
        leading=26,
        textColor=C_DARK,
        alignment=0, # Left
        spaceAfter=4
    )
    
    style_cover_subtitle = ParagraphStyle(
        'CoverSubTitle',
        fontName=FONT_BOLD,
        fontSize=12,
        leading=16,
        textColor=C_PRIMARY,
        spaceAfter=12
    )

    style_h1 = ParagraphStyle(
        'Heading1_Custom',
        fontName=FONT_BOLD,
        fontSize=13,
        leading=17,
        textColor=C_DARK,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    style_h2 = ParagraphStyle(
        'Heading2_Custom',
        fontName=FONT_BOLD,
        fontSize=10.5,
        leading=14,
        textColor=C_SECONDARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    style_body = ParagraphStyle(
        'Body_Custom',
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=13.5,
        textColor=C_TEXT,
        spaceAfter=5
    )

    style_body_bold = ParagraphStyle(
        'BodyBold_Custom',
        fontName=FONT_BOLD,
        fontSize=9,
        leading=13.5,
        textColor=C_DARK,
        spaceAfter=5
    )

    style_bullet = ParagraphStyle(
        'Bullet_Custom',
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=12.5,
        textColor=C_TEXT,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    style_badge = ParagraphStyle(
        'Badge_Custom',
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#92400E"),
        alignment=1
    )

    style_table_cell = ParagraphStyle(
        'TableCell',
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=11.5,
        textColor=C_TEXT
    )

    style_table_header = ParagraphStyle(
        'TableHeader',
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=12,
        textColor=colors.white
    )

    story = []

    # ==================== HEADER BLOCK ====================
    header_data = [
        [
            Paragraph("<b>huaychan (ห้วยชัน) — ระบบสั่งอาหารเดลิเวอรีระดับชุมชน</b>", style_cover_title),
            Paragraph("<font color='#059669'><b>สถานะ: พร้อมใช้งาน 100%</b></font><br/><font color='#64748B' size=7.5>Production Ready</font>", ParagraphStyle('Status', fontName=FONT_REGULAR, fontSize=8, leading=11, alignment=2))
        ],
        [
            Paragraph("<b>Hyperlocal Food Delivery Web & Mobile Application (กรณีศึกษา ชุมชนห้วยชัน-นาฝาย & มรภ.ชัยภูมิ)</b>", style_cover_subtitle),
            Paragraph("<font color='#64748B' size=8>เวอร์ชัน: 1.0.4 (Production)</font>", ParagraphStyle('Ver', fontName=FONT_REGULAR, fontSize=8, leading=11, alignment=2))
        ]
    ]
    header_table = Table(header_data, colWidths=[380, 135])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=C_PRIMARY, spaceBefore=4, spaceAfter=8))

    # ==================== EXECUTIVE SUMMARY CARD ====================
    summary_text = (
        "<b>บทสรุปผู้บริหาร (Executive Summary):</b> โครงงาน <b>huaychan</b> เป็นการออกแบบและพัฒนาระบบเทคโนโลยีสารสนเทศแบบครบวงจร (Full-Stack Application) เพื่อเป็นแพลตฟอร์มตัวกลางสั่งอาหารระดับท้องถิ่น (Hyperlocal Community Platform) แก้ปัญหาข้อจำกัดของแอปพลิเคชันส่วนกลางขนาดใหญ่ที่มีค่าธรรมเนียม GP สูง (30-35%) และพื้นที่จัดส่งไม่ครอบคลุมหอพักรอบมหาวิทยาลัย "
        "โดย huaychan รองรับการสั่งซื้ออาหารแบบเรียลไทม์, แชทสดคุยตรงกับร้านค้า, ชำระเงินด้วย QR Code อัตโนมัติ, แจ้งเตือนกระดิ่งหน้าร้านค้าวนซ้ำ, และรองรับทั้งเว็บเบราว์เซอร์และสมาร์ตโฟน Android (APK / Google Play Store AAB) ด้วยมาตรฐานความปลอดภัยระดับสากล"
    )
    summary_table = Table(
        [[Paragraph(summary_text, style_body)]],
        colWidths=[515]
    )
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 9),
        ('RIGHTPADDING', (0,0), (-1,-1), 9),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 8))

    # ==================== SECTION 1: ที่มาและวัตถุประสงค์ ====================
    story.append(Paragraph("1. ที่มา ความสำคัญ และวัตถุประสงค์ของโครงงาน", style_h1))
    
    col1_text = (
        "<b>สภาพปัญหาเดิม (Pain Points):</b><br/>"
        "• ร้านค้าชุมชนริมทางและร้านรอบ มรภ.ชัยภูมิ ไม่สามารถเข้าร่วมแอปส่งอาหารใหญ่ๆ ได้ เนื่องจากถูกหักค่า GP สูงถึง 30-35% ทำให้ขาดทุนหรือต้องบวกราคาอาหารเพิ่ม<br/>"
        "• นักศึกษาและชาวบ้านในพื้นที่ต้องเสียค่าส่งแพง และระยะเวลาจัดส่งล่าช้า<br/>"
        "• ร้านค้าขาดช่องทางออนไลน์ในการรับออเดอร์โดยตรงที่เป็นระเบียบ"
    )
    col2_text = (
        "<b>วัตถุประสงค์หลัก (Project Objectives):</b><br/>"
        "1. เพื่อพัฒนาเว็บและโมบายล์แอปพลิเคชันสั่งอาหารที่ไม่มีค่า GP สูง (ฟรีค่าคอมมิชชั่น 0% หรือหักตามจริง)<br/>"
        "2. เพื่อสร้างระบบจับคู่ออเดอร์และแชทสด (Real-time P2P) ระหว่างผู้ซื้อกับร้านค้าในพื้นที่อย่างมีประสิทธิภาพ<br/>"
        "3. เพื่อส่งเสริมเศรษฐกิจดิจิทัลระดับฐานราก ให้ร้านค้าท้องถิ่นบริหารจัดการธุรกิจตนเองได้ง่าย"
    )
    
    p1_table = Table(
        [[Paragraph(col1_text, style_body), Paragraph(col2_text, style_body)]],
        colWidths=[252, 253]
    )
    p1_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor("#FEF2F2")), # Light Red
        ('BACKGROUND', (1,0), (1,0), colors.HexColor("#ECFDF5")), # Light Green
        ('BOX', (0,0), (0,0), 0.8, colors.HexColor("#FECACA")),
        ('BOX', (1,0), (1,0), 0.8, colors.HexColor("#A7F3D0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(p1_table)
    story.append(Spacer(1, 8))

    # ==================== SECTION 2: สถาปัตยกรรมและเทคโนโลยี ====================
    story.append(Paragraph("2. สถาปัตยกรรมระบบและเทคโนโลยีที่เลือกใช้ (System Architecture & Tech Stack)", style_h1))
    
    tech_data = [
        [
            Paragraph("<b>ส่วนประกอบ (Component)</b>", style_table_header),
            Paragraph("<b>เทคโนโลยีที่ใช้ (Tech Stack)</b>", style_table_header),
            Paragraph("<b>บทบาทและหน้าที่ในระบบ (Role & Responsibility)</b>", style_table_header)
        ],
        [
            Paragraph("<b>Frontend Web Application</b>", style_table_cell),
            Paragraph("Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS", style_table_cell),
            Paragraph("ส่วนติดต่อผู้ใช้ (UI/UX) ตอบสนองรวดเร็ว รองรับ Responsive ทุกอุปกรณ์ โหลดเร็วด้วย SSR/SSG", style_table_cell)
        ],
        [
            Paragraph("<b>Mobile Application</b>", style_table_cell),
            Paragraph("Capacitor 8 (Android Native Container), Android SDK, AAB/APK", style_table_cell),
            Paragraph("แปลงเว็บแอปพลิเคชันเป็นแอป Android สมบูรณ์แบบ รองรับ Live Over-The-Air Update และ Google Play Store", style_table_cell)
        ],
        [
            Paragraph("<b>Authentication</b>", style_table_cell),
            Paragraph("LINE OAuth 2.0 API & Firebase Authentication (JWT)", style_table_cell),
            Paragraph("เข้าสู่ระบบสะดวกรวดเร็วผ่าน LINE ไม่ต้องจำรหัสผ่าน พร้อมระบบจัดการสิทธิ์ Role-Based Access Control", style_table_cell)
        ],
        [
            Paragraph("<b>Database & Storage</b>", style_table_cell),
            Paragraph("Google Cloud Firestore (NoSQL Real-time Database)", style_table_cell),
            Paragraph("จัดเก็บและซิงก์ข้อมูลออเดอร์, ข้อความแชท, เมนูอาหาร แบบเรียลไทม์ระดับ Milliseconds พร้อม Security Rules", style_table_cell)
        ],
        [
            Paragraph("<b>Backend Serverless</b>", style_table_cell),
            Paragraph("Firebase Cloud Functions (Node.js 20)", style_table_cell),
            Paragraph("คำนวณราคาแบบ Authoritative ป้องกันการแก้ราคา, จัดการคิวออเดอร์ (Idempotency), และส่ง QR โค้ดอัตโนมัติ", style_table_cell)
        ],
        [
            Paragraph("<b>Push & Hardware API</b>", style_table_cell),
            Paragraph("Firebase Cloud Messaging (FCM), Web Audio API, Screen WakeLock", style_table_cell),
            Paragraph("ส่งการแจ้งเตือน Push Notification แม้ปิดแอป, เล่นเสียงกระดิ่งเตือนวนซ้ำหน้าร้าน, และป้องกันหน้าจอดับ", style_table_cell)
        ],
    ]

    tech_table = Table(tech_data, colWidths=[110, 160, 245])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 9))

    # ==================== SECTION 3: ฟังก์ชันการทำงานหลัก ====================
    story.append(Paragraph("3. โมดูลและการทำงานหลักของระบบ (Core System Modules)", style_h1))

    modules_data = [
        [
            Paragraph("<b>โมดูลสำหรับลูกค้า (Customer Portal)</b>", style_h2),
            Paragraph("<b>โมดูลสำหรับร้านค้า (Merchant Dashboard)</b>", style_h2),
            Paragraph("<b>โมดูลผู้ดูแลระบบ (Admin Console)</b>", style_h2)
        ],
        [
            Paragraph(
                "• <b>LINE Login:</b> ล็อกอิน 1 คลิกไม่ต้องกรอกฟอร์ม<br/>"
                "• <b>Smart Feed:</b> สุ่มแสดงร้านค้าและเมนูอาหารอย่างเป็นธรรม (Fair Shuffle)<br/>"
                "• <b>Cart & Options:</b> ตะกร้าสินค้า เลือกท็อปปิ้ง และระบุโน้ตพิเศษ<br/>"
                "• <b>Auto QR & Chat:</b> แชทสดพร้อม QR Code และปุ่มคัดลอกเลขบัญชี โอนแล้วแนบสลิปได้ทันที<br/>"
                "• <b>Live Tracking:</b> ติดตาม 4 สถานะสด (รอรับ ➔ กำลังปรุง ➔ กำลังส่ง ➔ ส่งถึงมือ)<br/>"
                "• <b>Rating & Review:</b> ระบบให้คะแนนดาวและรีวิว",
                style_bullet
            ),
            Paragraph(
                "• <b>Continuous Alarm:</b> เสียงกระดิ่งดังเตือนวนซ้ำจนกว่าจะกดรับ ป้องกันการพลาดออเดอร์<br/>"
                "• <b>Auto Payment Message:</b> ส่งรูป QR Code, ยอดรวม และเลขบัญชีให้ลูกค้าอัตโนมัติ<br/>"
                "• <b>Menu Management:</b> เพิ่ม/แก้ไข/ปิดเมนูหมด พร้อมเครื่องมือ Crop รูปภาพ<br/>"
                "• <b>Store Control:</b> สวิตช์เปิด-ปิดร้าน และปุ่มเปิดหน้าจอค้างไว้ (WakeLock)<br/>"
                "• <b>Sales Summary:</b> สรุปยอดขายรายวัน/สัปดาห์ และประวัติเครดิต",
                style_bullet
            ),
            Paragraph(
                "• <b>Merchant Provisioning:</b> สร้างและกำหนดบัญชีร้านค้าเข้าสู่ระบบ<br/>"
                "• <b>Credit & GP Control:</b> ระบบเติม/ปรับลดยอดเครดิตร้านค้า และเปิด-ปิดระบบ GP (0-5%)<br/>"
                "• <b>System Settings:</b> กำหนดค่าจัดส่งเริ่มต้นและข้อมูลติดต่อส่วนกลาง<br/>"
                "• <b>Data & Security Audit:</b> ตรวจสอบประวัติการทำรายการและระงับบัญชีเมื่อเกิดข้อพิพาท",
                style_bullet
            )
        ]
    ]

    modules_table = Table(modules_data, colWidths=[171, 172, 172])
    modules_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(modules_table)
    story.append(Spacer(1, 9))

    # ==================== SECTION 4: ความปลอดภัยและการรับมือข้อผิดพลาด ====================
    story.append(Paragraph("4. ความปลอดภัย ความเสถียร และความน่าเชื่อถือของระบบ (Security & Reliability)", style_h1))

    sec_data = [
        [
            Paragraph("<b>ประเด็นความปลอดภัย</b>", style_table_header),
            Paragraph("<b>กลไกการป้องกันของระบบ huaychan</b>", style_table_header),
            Paragraph("<b>ผลลัพธ์และความมั่นใจ</b>", style_table_header)
        ],
        [
            Paragraph("<b>การป้องกันการปลอมแปลง QR Code</b>", style_table_cell),
            Paragraph("Firestore Security Rules กฎ <code>merchant(shop)</code> ตรวจสอบสิทธิ์ที่ฝั่ง Server อนุญาตให้เฉพาะเจ้าของร้านแก้ไขข้อมูลบัญชีตนเองเท่านั้น", style_table_cell),
            Paragraph("ป้องกันคนภายนอก/แฮกเกอร์แก้ไข QR Code รับเงินได้ 100%", style_table_cell)
        ],
        [
            Paragraph("<b>การป้องกันการแก้ไขราคาอาหาร</b>", style_table_cell),
            Paragraph("ตรรกะการคำนวณราคาทำงานบน Cloud Functions (Authoritative Pricing) อ่านราคาจริงจากฐานข้อมูล Server-side ไม่เชื่อถือราคาจาก Client", style_table_cell),
            Paragraph("ป้องกันการแฮกแก้ไขตัวเลขยอดเงินในตะกร้าสินค้า", style_table_cell)
        ],
        [
            Paragraph("<b>การป้องกันออเดอร์ซ้ำซ้อน</b>", style_table_cell),
            Paragraph("ระบบ Idempotency Key ร่วมกับ Firestore Atomic Transaction ตรวจสอบคีย์การสั่งซื้อทุกครั้งก่อนบันทึก", style_table_cell),
            Paragraph("หากเน็ตสะดุดแล้วกดสั่งซ้ำ ระบบจะไม่สร้างออเดอร์เบิ้ล", style_table_cell)
        ],
        [
            Paragraph("<b>การคุ้มครองทางกฎหมาย & ข้อกำหนด</b>", style_table_cell),
            Paragraph("ระบบมีหน้าข้อกำหนดการใช้งาน (Terms of Service) และนโยบายความเป็นส่วนตัว (PDPA) ระบุสถานะระบบเป็นตัวกลางการสื่อสาร (Matching Platform)", style_table_cell),
            Paragraph("เงินโอนตรง P2P ระหว่างผู้ซื้อ-ผู้ขาย แพลตฟอร์มไม่ถือครองเงิน", style_table_cell)
        ]
    ]

    sec_table = Table(sec_data, colWidths=[120, 240, 155])
    sec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_DARK),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(sec_table)
    story.append(Spacer(1, 9))

    # ==================== SECTION 5: ผลการทดสอบและการนำไปใช้งานจริง ====================
    story.append(Paragraph("5. ผลการทดสอบและการนำไปใช้งานจริง (Testing & Production Deployment)", style_h1))

    deploy_summary = (
        "<b>สถานะการทดสอบและ Deploy ขึ้นระบบจริง:</b><br/>"
        "• <b>Automated Unit Tests:</b> ผ่านการทดสอบระดับ Server Transaction และ Security Rule ครบ <b>16/16 Test Cases</b> (100% Pass)<br/>"
        "• <b>Production Web Hosting:</b> เปิดให้บริการจริงผ่าน Google Firebase Global CDN ที่ <font color='#D97706'><u>https://huaychan.web.app</u></font><br/>"
        "• <b>Android APK File:</b> คอมไพล์เป็นไฟล์ติดตั้ง <code>huaychan.apk</code> ขนาด <b>10.18 MB</b> โหลดได้ตรงจากหน้าเว็บ<br/>"
        "• <b>Google Play Store Bundle:</b> คอมไพล์เป็นไฟล์ <code>huaychan-release.aab</code> ขนาด <b>9.9 MB</b> พร้อมสำหรับการปล่อยบน Google Play Store"
    )

    deploy_table = Table(
        [[Paragraph(deploy_summary, style_body)]],
        colWidths=[515]
    )
    deploy_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")), # Light Blue
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BFDBFE")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 9),
        ('RIGHTPADDING', (0,0), (-1,-1), 9),
    ]))
    story.append(deploy_table)
    story.append(Spacer(1, 8))

    # ==================== SECTION 6: ประโยชน์และคุณค่า ====================
    story.append(Paragraph("6. คุณค่าและประโยชน์ที่ได้รับจากโครงงาน (Project Value & Impact)", style_h1))
    
    impact_data = [
        [
            Paragraph("<b>ด้านเศรษฐกิจและชุมชน</b>", style_body_bold),
            Paragraph("<b>ด้านผู้ใช้งาน (นักศึกษา/ชาวบ้าน)</b>", style_body_bold),
            Paragraph("<b>ด้านทักษะวิศวกรรมซอฟต์แวร์</b>", style_body_bold)
        ],
        [
            Paragraph("เพิ่มรายได้ให้ร้านค้าริมทางและร้านอาหารในชุมชนห้วยชัน-นาฝาย ไม่ต้องแบกรับต้นทุนค่า GP สูงถึง 35%", style_bullet),
            Paragraph("สั่งอาหารง่าย ค่าส่งถูก ได้รับอาหารสดใหม่จากร้านใกล้เคียง สามารถพิมพ์คุยกับร้านค้าได้โดยตรง", style_bullet),
            Paragraph("ได้ประยุกต์ใช้สถาปัตยกรรม Full-Stack Modern Web & Mobile, Serverless Cloud, Realtime NoSQL และ Web APIs", style_bullet)
        ]
    ]
    impact_table = Table(impact_data, colWidths=[171, 172, 172])
    impact_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(impact_table)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Project summary PDF created successfully: {output_filename}")

if __name__ == "__main__":
    out_file = "huaychan_project_summary.pdf"
    if len(sys.argv) > 1:
        out_file = sys.argv[1]
    create_project_summary_pdf(out_file)
