type SparklineProps = {
  values: number[];
  className?: string;
};

const buildPath = (values: number[], width: number, height: number) => {
  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    const y = height / 2;
    return `M0 ${y} L${width} ${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
};

export function Sparkline({ values, className }: SparklineProps) {
  const width = 120;
  const height = 36;
  const path = buildPath(values, width, height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1 || 1);

  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden={values.length <= 1}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-axoft-300/80"
      />
      {values.map((value, index) => {
        if (!path) {
          return null;
        }
        const x = index * step;
        const y = height - ((value - min) / range) * height;
        return (
          <circle
            key={`${value}-${index}`}
            cx={x}
            cy={y}
            r={index === values.length - 1 ? 2.8 : 2}
            className={
              index === values.length - 1
                ? "fill-axoft-200"
                : "fill-axoft-500/70"
            }
          />
        );
      })}
    </svg>
  );
}
