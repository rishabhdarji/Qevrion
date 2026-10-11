import type * as Phone from './photos';

// The desktop web preview's stand-in for photos.ts; the iPhone never loads this file.
// In a browser a picked photo already has an address the page can show, so that address
// is kept as it is and there are no files to copy or delete.

export const keepPhoto: typeof Phone.keepPhoto = (pickedUri) => pickedUri;
export const photoUri: typeof Phone.photoUri = (name) => name;
export const photoName: typeof Phone.photoName = (uri) => uri;
export const dropPhoto: typeof Phone.dropPhoto = () => {};
export const dropAllPhotos: typeof Phone.dropAllPhotos = () => {};
