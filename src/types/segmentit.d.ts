declare module "segmentit" {
  export class Segment {
    use(modules: unknown): Segment
    loadDict(dict: unknown): Segment
    loadSynonymDict(dict: unknown): Segment
    loadStopwordDict(dict: unknown): Segment
    doSegment(text: string, options?: { simple?: boolean }): Array<string | { w?: string }>
  }

  export const modules: unknown
  export const dicts: unknown
  export const synonyms: unknown
  export const stopwords: unknown
}
