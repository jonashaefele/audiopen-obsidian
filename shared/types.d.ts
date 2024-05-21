export interface BufferItemData {
  id: string
  title: string
  body: string
  orig_transcript: string
  tags: string[]
  date_created: string
}

export interface BufferItem {
  id: string
  exp: Date
  data: BufferItemData
}
