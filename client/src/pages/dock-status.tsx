import { useEffect } from "react";
import { useLocation } from "wouter";

export default function DockStatus() {
  const [, setLocation] = useLocation();

  // Redirect to the schedules page (which shows dock status too)
  useEffect(() => {
    setLocation("/schedules");
  }, [setLocation]);

  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <p className="text-gray-500">Redirecting to Schedules...</p>
    </div>
  );
}
