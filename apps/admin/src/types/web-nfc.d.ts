type NDEFReader = {
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
  scan(options?: { signal?: AbortSignal }): Promise<void>;
};

type NDEFReadingEvent = {
  serialNumber: string | null;
  message: NDEFMessage;
} & Event;

type NDEFMessage = {
  records: readonly NDEFRecord[];
};

type NDEFRecord = {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
};

declare const NDEFReader: {
  prototype: NDEFReader;
  new (): NDEFReader;
};
