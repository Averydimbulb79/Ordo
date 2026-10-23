export const EXPORT_FORMATS={
 mp4:{video:'avc',audio:'aac',container:'mp4',extension:'mp4',mime:'video/mp4',label:'MP4 · H.264 / AAC'},
 'mp4-hevc':{video:'hevc',audio:'aac',container:'mp4',extension:'mp4',mime:'video/mp4',label:'MP4 · H.265 (HEVC) / AAC'},
 webm:{video:'vp8',audio:'opus',container:'webm',extension:'webm',mime:'video/webm',label:'WebM · VP8 / Opus'}
} as const;
export type Format=keyof typeof EXPORT_FORMATS;
