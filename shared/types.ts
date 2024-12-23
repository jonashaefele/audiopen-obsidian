export interface BufferItemData {
  id: string
  title: string
  body: string
  transcript?: string
  orig_transcript?: string
  tags: string[]
  date_created?: string
  timestamp?: string
  platform: 'voicenotes' | 'audiopen'
}

export interface BufferItem {
  id: string
  exp: Date
  data: BufferItemData
}

export type NewLineType = 'windows' | 'unixMac' | undefined
