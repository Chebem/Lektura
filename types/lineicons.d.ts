/**
 * Local type declarations for @lineiconshq/free-icons.
 *
 * The published package (v1.0.7) ships dist/index.d.ts, which re-exports from
 * ./icons/<Name> — but that directory is not in the tarball. Every icon
 * import therefore shows "cannot resolve" in the IDE even though it resolves
 * fine at runtime and in the build.
 *
 * These declarations cover the icons the app actually uses. Add a line here
 * when Icon.jsx starts using a new one.
 */
declare module '@lineiconshq/free-icons' {
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
}
