import { Lineicons } from '@lineiconshq/react-lineicons';
import {
  Sun1Outlined,
  MoonHalfRight5Outlined,
  CloudUploadOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  ChevronDownOutlined,
  PlusOutlined,
  MinusOutlined,
  Search1Outlined,
  XmarkOutlined,
  MenuHamburger1Outlined,
  StarFatOutlined,
  Book1Outlined,
  MicroscopeOutlined,
  Message2Outlined,
  Pencil1Outlined,
  Bulb2Outlined,
  CheckOutlined,
  QuestionMarkCircleOutlined,
  Bolt2Outlined,
  DashboardSquare1Outlined,
  Layout9Outlined,
  FileMultipleOutlined,
  Trophy1Outlined,
  EyeOutlined,
} from '@lineiconshq/free-icons';
import './Icon.css';

/**
 * Every icon in the app comes through here.
 *
 * Components ask for a role ("next", "upload") rather than a Lineicons
 * export name, so swapping or renaming the icon set is a change to this file
 * alone.
 *
 * Note on versions: @lineiconshq/free-icons v1.0.7 exports IconData objects
 * ({name, svg, viewBox, …}) with unsuffixed names, which is what <Lineicons>
 * expects. An older 0.0.1 copy sits nested under react-lineicons and exports
 * React components named with a "Rounded" suffix — importing those names
 * here yields undefined and makes <Lineicons> throw on icon.svg.
 */
const ICONS = {
  // chrome
  sun: Sun1Outlined,
  moon: MoonHalfRight5Outlined,
  upload: CloudUploadOutlined,
  menu: MenuHamburger1Outlined,
  close: XmarkOutlined,
  search: Search1Outlined,

  // navigation
  prev: ChevronLeftOutlined,
  next: ChevronRightOutlined,
  down: ChevronDownOutlined,

  // controls
  zoomIn: PlusOutlined,
  zoomOut: MinusOutlined,
  grid: DashboardSquare1Outlined,
  stack: Layout9Outlined,

  // card categories
  vocab: Book1Outlined,
  terminology: MicroscopeOutlined,
  pattern: Message2Outlined,
  grammar: Pencil1Outlined,
  concept: Bulb2Outlined,
  exam: StarFatOutlined,

  // states
  document: FileMultipleOutlined,
  cards: Bolt2Outlined,
  quiz: QuestionMarkCircleOutlined,
  known: CheckOutlined,
  score: Trophy1Outlined,
  view: EyeOutlined,
};

export default function Icon({ name, size = 18, className = '', ...rest }) {
  const icon = ICONS[name];

  if (!icon) {
    // A missing icon should be obvious in development, never a crash.
    console.warn(`[Icon] unknown icon "${name}"`);
    return null;
  }

  return (
    <Lineicons
      icon={icon}
      size={size}
      className={`icon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}
