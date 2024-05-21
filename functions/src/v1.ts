import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as express from 'express'
import * as crypto from 'crypto'

admin.initializeApp()
const webhookApp = express()
// Add middleware to parse JSON request body
webhookApp.use(express.json())

webhookApp.post(
  '/:key',
  async (req: express.Request, res: express.Response) => {
    const user = await (
      await admin.database().ref(`/keys/${req.params.key}`).get()
    ).val()
    if (!user) {
      return res.status(403).send('Invalid key')
    }

    const today = new Date()
    const exp = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 7
    )

    const { id, title, body, orig_transcript, tags, date_created } = req.body

    let mode: string
    const qMode: unknown = req.query.mode
    switch (qMode) {
      case 'update':
        mode = 'update'
      case 'create':
      default:
        mode = 'create'
    }

    // Validate the required fields and their types
    if (
      typeof id !== 'string' ||
      typeof title !== 'string' ||
      typeof body !== 'string' ||
      typeof orig_transcript !== 'string'
    ) {
      return res
        .status(400)
        .send(
          'Invalid field types in the request body, needs at least id, title, body and orig_transcript'
        )
    }

    const buffer = {
      id: crypto.randomBytes(16).toString('hex'),
      exp,
      data: {
        id,
        title,
        body,
        orig_transcript,
        tags:
          typeof tags === 'string' // tags can be undefined
            ? tags.split(',').map((tag) => tag.trim())
            : [],
        date_created,
        mode,
      },
    }
    await admin.database().ref(`/buffer/${user}`).push(buffer)
    res.send('ok')
    return
  }
)

export const webhook = functions
  .region('europe-west1')
  .https.onRequest(webhookApp)

export const newUser = functions
  .region('europe-west1')
  .auth.user()
  .onCreate((user) => {
    const key = crypto.randomBytes(24).toString('hex')
    admin.database().ref(`/keys/${key}`).set(user.uid)
    admin.database().ref(`/users/${user.uid}/key`).set(key)
  })

export const wipe = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (context.auth) {
      const user = await admin.auth().getUser(context.auth.uid)
      if (user.providerData[0].providerId != 'anonymous') {
        const db = admin.database()
        const ref = db.ref(`/buffer/${user.uid}`)
        await ref.transaction((buffer) => {
          if (buffer == null) {
            return buffer
          }
          if (typeof buffer == 'object') {
            const arr: { id: string }[] = Object.values(buffer)
            const index = arr.findIndex((v) => v.id === data.id)
            return arr.splice(index + 1)
          }
          throw new Error(
            `buffer not as expected ${typeof buffer} ${JSON.stringify(buffer)}`
          )
        })
      }
    }
  })

export const generateObsidianToken = functions
  .region('europe-west1')
  .https.onCall((_data, context) => {
    if (context.auth) {
      return admin.auth().createCustomToken(context.auth.uid)
    }
    throw new Error('authed only')
  })
