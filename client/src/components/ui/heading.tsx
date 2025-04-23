import { Separator } from './separator';

interface HeadingProps {
  title: string;
  description?: string;
  className?: string;
}

export function Heading({ title, description, className }: HeadingProps) {
  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>
      <Separator />
    </div>
  );
}