import { Directory, File, Paths } from 'expo-file-system';

// Event photos are files in the app's own folder, beside the database. Nothing here
// leaves the phone.
//
// The database stores a photo's file name, never its full address: iOS moves the app's
// folder when the app is updated, so an address saved today may not exist tomorrow.

const folder = () => new Directory(Paths.document, 'photos');

/** Copies a picked photo into the app's folder. Returns the name to store. */
export function keepPhoto(pickedUri: string): string {
  folder().create({ idempotent: true, intermediates: true });
  // The name is ours from start to finish; only a plain file ending is taken from the
  // picked file's address.
  const ending = /\.[a-z0-9]{1,5}$/i.exec(pickedUri)?.[0].toLowerCase() ?? '.jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ending}`;
  new File(pickedUri).copySync(new File(folder(), name));
  return name;
}

/** Where a stored photo is, for showing it. */
export function photoUri(name: string): string {
  return new File(folder(), name).uri;
}

/** The stored name behind an address from `photoUri`, or null for anything else, such as a fresh pick. */
export function photoName(uri: string): string | null {
  const name = uri.slice(uri.lastIndexOf('/') + 1);
  return name !== '' && photoUri(name) === uri ? name : null;
}

export function dropPhoto(name: string | null): void {
  // A stored name never has a folder in it; anything that does is not ours to delete.
  if (!name || name.includes('/') || name.includes('\\')) return;
  const file = new File(folder(), name);
  if (file.exists) file.delete();
}

export function dropAllPhotos(): void {
  if (folder().exists) folder().delete();
}
