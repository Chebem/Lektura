import { Lineicons } from '@lineiconshq/react-lineicons';
import {
  Sun1OutlinedRounded,
  MoonHalfRight5OutlinedRounded,
  CloudUploadOutlinedRounded,
  ChevronLeftOutlinedRounded,
  ChevronDownOutlinedRounded,
  PlusOutlinedRounded,
  MinusOutlinedRounded,
  Search1OutlinedRounded,
  XmarkOutlinedRounded,
  MenuHamburger1OutlinedRounded,
  StarFatOutlinedRounded,
  Book1OutlinedRounded,
  MicroscopeOutlinedRounded,
  Message2OutlinedRounded,
  Pencil1OutlinedRounded,
  Bulb2OutlinedRounded,
  CheckOutlinedRounded,
  QuestionMarkCircleOutlinedRounded,
  Bolt2OutlinedRounded,
  DashboardSquare1OutlinedRounded,
  Layout9OutlinedRounded,
  FileMultipleOutlinedRounded,
  Trophy1OutlinedRounded,
  EyeOutlinedRounded,
} from '@lineiconshq/free-icons';
import './Icon.css';

/**
 * Every icon in the app comes through here.
 *
 * Components ask for a role ("next", "upload") rather than a Lineicons
 * export name, so swapping or renaming the icon set is a change to this file
 * alone. It also papers over gaps in the free set — there is no
 * ChevronRight, so "next" is a left chevron rotated 180°.
 */
const ICONS = {
  // chrome
  sun: Sun1OutlinedRounded,
  moon: MoonHalfRight5OutlinedRounded,
  upload: CloudUploadOutlinedRounded,
  menu: MenuHamburger1OutlinedRounded,
  close: XmarkOutlinedRounded,
  search: Search1OutlinedRounded,

  // navigation
  prev: ChevronLeftOutlinedRounded,
  next: ChevronLeftOutlinedRounded, // rotated — see `rotate` below
  down: ChevronDownOutlinedRounded,

  // controls
  zoomIn: PlusOutlinedRounded,
  zoomOut: MinusOutlinedRounded,
  grid: DashboardSquare1OutlinedRounded,
  stack: Layout9OutlinedRounded,

  // card categories
  vocab: Book1OutlinedRounded,
  terminology: MicroscopeOutlinedRounded,
  pattern: Message2OutlinedRounded,
  grammar: Pencil1OutlinedRounded,
  concept: Bulb2OutlinedRounded,
  exam: StarFatOutlinedRounded,

  // states
  document: FileMultipleOutlinedRounded,
  cards: Bolt2OutlinedRounded,
  quiz: QuestionMarkCircleOutlinedRounded,
  known: CheckOutlinedRounded,
  score: Trophy1OutlinedRounded,
  view: EyeOutlinedRounded,
};

/** Icons that need rotating because the free set has no mirrored variant. */
const ROTATED = { next: 180 };

export default function Icon({ name, size = 18, className = '', ...rest }) {
  const icon = ICONS[name];

  if (!icon) {
    // A missing icon should be obvious in development, never a crash.
    console.warn(`[Icon] unknown icon "${name}"`);
    return null;
  }

  const rotate = ROTATED[name];

  return (
    <Lineicons
      icon={icon}
      size={size}
      className={`icon ${className}`.trim()}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}
