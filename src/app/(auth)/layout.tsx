interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): React.ReactElement {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 selection:bg-primary/30">
      {/* Immersive ambient background */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-background bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <div className="absolute -top-[20%] -left-[10%] h-[70%] w-[50%] rounded-[100%] bg-primary/20 opacity-30 blur-[120px] mix-blend-screen" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[70%] w-[50%] rounded-[100%] bg-blue-600/10 opacity-30 blur-[150px] mix-blend-screen" />
      </div>

      {/* Floating Glass Container */}
      <div className="relative z-10 w-full max-w-md rounded-[2.5rem] glass p-8 shadow-2xl shadow-primary/5 sm:p-12">
        {children}
      </div>
    </div>
  );
}
