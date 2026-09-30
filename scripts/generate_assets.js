const sharp = require('sharp');

async function run() {
  const input1 = 'C:/Users/LENOVO/.gemini/antigravity/brain/c281f522-d52d-498d-8383-9442a449f46e/app_logo_vector_1789418024014.jpg';
  const size1 = 740;
  const left1 = Math.round(512 - size1 / 2);
  const top1 = Math.round(512 - size1 / 2);
  const r1 = size1 / 2;
  const mask1 = Buffer.from(`<svg width="${size1}" height="${size1}"><circle cx="${r1}" cy="${r1}" r="${r1}" fill="#fff" /></svg>`);

  const cropped1 = await sharp(input1)
    .extract({ left: left1, top: top1, width: size1, height: size1 })
    .composite([{ input: mask1, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Save brand logos
  await sharp(cropped1).resize(512, 512).toFile('d:/tonpalmproject/public/logo.png');
  await sharp(cropped1).resize(192, 192).toFile('d:/tonpalmproject/public/icon-192.png');
  await sharp(cropped1).resize(512, 512).toFile('d:/tonpalmproject/public/icon-512.png');
  
  // Next.js app icons & favicon
  await sharp(cropped1).resize(192, 192).toFile('d:/tonpalmproject/src/app/icon.png');
  await sharp(cropped1).resize(180, 180).toFile('d:/tonpalmproject/src/app/apple-icon.png');
  await sharp(cropped1).resize(32, 32).toFile('d:/tonpalmproject/public/favicon.ico');
  await sharp(cropped1).resize(32, 32).toFile('d:/tonpalmproject/src/app/favicon.ico');

  // Option 2: Rider mascot
  const input2 = 'C:/Users/LENOVO/.gemini/antigravity/brain/c281f522-d52d-498d-8383-9442a449f46e/app_logo_delivery_1789418038896.jpg';
  const size2 = 672;
  const left2 = Math.round(512 - size2 / 2);
  const top2 = Math.round(512 - size2 / 2);
  const r2 = size2 / 2;
  const mask2 = Buffer.from(`<svg width="${size2}" height="${size2}"><circle cx="${r2}" cy="${r2}" r="${r2}" fill="#fff" /></svg>`);

  const cropped2 = await sharp(input2)
    .extract({ left: left2, top: top2, width: size2, height: size2 })
    .composite([{ input: mask2, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp(cropped2).resize(512, 512).toFile('d:/tonpalmproject/public/logo_rider.png');

  console.log('Successfully created all logos and icons!');
}

run().catch(console.error);
