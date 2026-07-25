// Uploads the RCT2 sprite atlas to Magic Patterns' main S3 bucket
// (mirrorful-production, us-west-1, public-read) exactly like
// apps/server/src/services/s3Service. Run it with Infisical so the
// S3_ACCESS_KEY / S3_ACCESS_SECRET creds are injected:
//
//   cd ~/patterns && infisical run --env=prod -- \
//     node /Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/extract/upload_s3.cjs
//
// (if --env=prod errors, try --env=dev or --env=staging)
// It prints S3_URL and CDN_URL — paste either back to me.

const { readFileSync } = require('node:fs')
// resolve the AWS SDK from the patterns monorepo node_modules
const { PutObjectCommand, S3Client } = require('/Users/alexanderlee/patterns/node_modules/@aws-sdk/client-s3')

const BUCKET = 'mirrorful-production'
const REGION = 'us-west-1'
const KEY = 'rct2-real-assets/atlas-v1.png'
const FILE = '/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/assets/atlas.png'

const accessKeyId = process.env.S3_ACCESS_KEY
const secretAccessKey = process.env.S3_ACCESS_SECRET
if (!accessKeyId || !secretAccessKey) {
  console.error('MISSING_CREDS: S3_ACCESS_KEY / S3_ACCESS_SECRET not in env (run via `infisical run`)')
  process.exit(2)
}

;(async () => {
  const s3 = new S3Client({ region: REGION, credentials: { accessKeyId, secretAccessKey } })
  const body = readFileSync(FILE)
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: KEY, Body: body, ACL: 'public-read', ContentType: 'image/png',
  }))
  console.log('UPLOAD_OK  (' + body.length + ' bytes)')
  console.log('S3_URL=https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + KEY)
  console.log('CDN_URL=https://cdn.magicpatterns.com/' + KEY)
})().catch((e) => { console.error('UPLOAD_FAILED:', e.message); process.exit(1) })
