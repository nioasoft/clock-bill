interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-3xl" | "max-w-4xl" | "max-w-5xl" | "max-w-6xl";
}

export function PageContainer({
  children,
  maxWidth = "max-w-6xl",
}: PageContainerProps) {
  return (
    <div className={`mx-auto ${maxWidth} px-4 py-5 sm:px-6 sm:py-7 lg:px-8`}>
      {children}
    </div>
  );
}
