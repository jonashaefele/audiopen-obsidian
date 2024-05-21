// Import the required modules individually
import { onRequest, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as crypto from 'crypto'

import type { BufferItem } from 'shared/types'

admin.initializeApp()

// Set the region globally for all functions
setGlobalOptions({ region: 'europe-west1' })

export const webhook = onRequest({ cors: true }, async (request, response) => {
  const key = request.params[0]
  const user = await (await admin.database().ref(`/keys/${key}`).get()).val()
  if (!user) {
    response.status(403).send('Invalid key')
    return
  }

  const today = new Date()
  const exp = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 7
  )

  const { id, title, body, orig_transcript, tags, date_created } = request.body

  // Validate the required fields and their types
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    typeof orig_transcript !== 'string'
  ) {
    response
      .status(400)
      .send(
        'Invalid field types in the request body, needs at least id, title, body and orig_transcript'
      )
    return
  }

  const buffer: BufferItem = {
    id: id,
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
    },
  }
  await admin.database().ref(`/buffer/${user}`).push(buffer)
  response.send('ok')
})

// V1 for auth triggers
export const newUser = functions
  .region('europe-west1')
  .auth.user()
  .onCreate((user) => {
    const key = crypto.randomBytes(24).toString('hex')
    admin.database().ref(`/keys/${key}`).set(user.uid)
    admin.database().ref(`/users/${user.uid}/key`).set(key)
  })

interface WipeData {
  id: string
}
export const wipe = onCall<WipeData>({ cors: true }, async ({ auth, data }) => {
  if (auth) {
    const user = await admin.auth().getUser(auth.uid)
    if (user.providerData[0].providerId != 'anonymous') {
      const db = admin.database()
      const ref = db.ref(`/buffer/${user.uid}`)
      await ref.transaction((buffer) => {
        if (buffer == null) {
          return buffer
        }
        // eslint-disable-next-line
        console.log('wiping', data)
        if (typeof buffer == 'object' && data.id !== undefined) {
          return (
            Object.entries(buffer)
              // @ts-ignore
              .filter(([key, value]) => value.id !== data.id)
              .reduce((obj, [key, value]) => {
                // @ts-ignore
                obj[key] = value
                return obj
              }, {})
          )
        }

        throw new Error(
          `buffer not as expected ${typeof buffer} ${JSON.stringify(buffer)}`
        )
      })
    }
  }
})

// TODO: v2 function errors out with that same error as before, fix later
// Permission 'iam.serviceAccounts.signBlob' denied on resource (or it may not exist).
// export const generateObsidianToken = onCall(async ({ auth }) => {
//   if (auth) {
//     return admin.auth().createCustomToken(auth.uid)
//   }
//   throw new Error('authed only')
// })
// V1 function:
export const generateObsidianToken = functions
  .region('europe-west1')
  .https.onCall((_data, context) => {
    if (context.auth) {
      return admin.auth().createCustomToken(context.auth.uid)
    }
    throw new Error('authed only')
  })
