import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

type DownloadIconProps = {
  size?: number;
  color?: string;
};

export const DownloadIcon = memo(({ size = 28, color = '#3B2222' }: DownloadIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v10m0 0l4-4m-4 4L8 9"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
));
