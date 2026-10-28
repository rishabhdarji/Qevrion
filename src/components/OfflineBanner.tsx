import { NoticeBanner } from './NoticeBanner';

type Props = {
  /** What still works, and what comes back once online. */
  body: string;
  solid?: boolean;
};

// Shown while the phone is offline, and gone the moment it is back.
export function OfflineBanner({ body, solid }: Props) {
  return <NoticeBanner icon="offline" title="You're offline" body={body} solid={solid} />;
}
