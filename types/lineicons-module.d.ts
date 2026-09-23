/**
 * Resolution target for the `paths` mapping in jsconfig.json.
 *
 * Same declarations as lineicons.d.ts but as a plain module rather than an
 * ambient one, because a `paths` entry must point at a module file. The
 * ambient copy stays for editors that ignore `paths`.
 */
export interface IconData {
    name: string;
    svg: string;
    viewBox: string;
    hasFill: boolean;
    hasStroke: boolean;
    hasStrokeWidth: boolean;
    defaultFill?: string;
    defaultStroke?: string;
  }

  export const Bolt2Outlined: IconData;
  export const Book1Outlined: IconData;
  export const Bulb2Outlined: IconData;
  export const CheckOutlined: IconData;
  export const ChevronDownOutlined: IconData;
  export const ChevronLeftOutlined: IconData;
  export const ChevronRightOutlined: IconData;
  export const CloudUploadOutlined: IconData;
  export const DashboardSquare1Outlined: IconData;
  export const EyeOutlined: IconData;
  export const FileMultipleOutlined: IconData;
  export const Layout9Outlined: IconData;
  export const MenuHamburger1Outlined: IconData;
  export const Message2Outlined: IconData;
  export const MicroscopeOutlined: IconData;
  export const MinusOutlined: IconData;
  export const MoonHalfRight5Outlined: IconData;
  export const Pencil1Outlined: IconData;
  export const PlusOutlined: IconData;
  export const QuestionMarkCircleOutlined: IconData;
  export const Search1Outlined: IconData;
  export const StarFatOutlined: IconData;
  export const Sun1Outlined: IconData;
  export const Trophy1Outlined: IconData;
  export const XmarkOutlined: IconData;
