export interface MarkerImage {
  id: string;
  uri: string;
  fileName?: string | null;
}

export interface MapMarkerData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images: MarkerImage[];
}

export type MarkerNavigationParams = Record<string, string | string[]> & {
  id: string;
};
