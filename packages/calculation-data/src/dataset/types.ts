export interface DatasetMetadata {
  id: string;
  standard: string;
  revision: string;
  source: string;
  validFrom: string;
  notes: string;
}

export interface DatasetWithMetadata {
  metadata: DatasetMetadata;
}
