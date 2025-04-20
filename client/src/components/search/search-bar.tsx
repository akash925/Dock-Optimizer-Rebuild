import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Schedule } from "@shared/schema";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type SearchResult = Schedule & {
  dockName?: string;
  facilityName?: string;
  facilityId?: number;
  appointmentTypeName?: string;
};

export default function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Debounce search
  const debouncedSearch = useCallback(
    (query: string) => {
      if (query.length >= 2) {
        setIsDropdownOpen(true);
      } else {
        setIsDropdownOpen(false);
      }
    },
    []
  );

  // Fetch search results
  const { data: searchResults = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/schedules/search", searchQuery],
    queryFn: ({ queryKey }) => {
      const query = queryKey[1] as string;
      return fetch(`/api/schedules/search?query=${encodeURIComponent(query)}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        });
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedIndex(-1);
    
    // Simple debounce implementation
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);
    
    return () => clearTimeout(timer);
  };

  const handleResultClick = (result: SearchResult) => {
    setLocation(`/schedules/${result.id}`);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) return;

    // Handle arrow key navigation
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selectedResult = searchResults[selectedIndex];
      if (selectedResult) {
        handleResultClick(selectedResult);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Format time for display
  const formatScheduleTime = (schedule: SearchResult) => {
    const startTime = new Date(schedule.startTime);
    
    // If we have a facilityName, use its timezone if available
    if (schedule.facilityId) {
      try {
        const timeStr = formatInTimeZone(
          startTime, 
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          "MMM d, h:mm a"
        );
        return timeStr;
      } catch (err) {
        console.error("Error formatting time with timezone:", err);
      }
    }
    
    // Fallback to local formatting
    return format(startTime, "MMM d, h:mm a");
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <Input
        type="text"
        placeholder="Search appointments..."
        className="w-full pl-9"
        value={searchQuery}
        onChange={handleSearch}
        onKeyDown={handleKeyDown}
        onFocus={() => searchQuery.length >= 2 && setIsDropdownOpen(true)}
      />
      <Search className="h-4 w-4 text-neutral-500 absolute left-3 top-1/2 transform -translate-y-1/2" />

      {/* Dropdown results */}
      {isDropdownOpen && (
        <div className="absolute mt-1 w-full bg-white rounded-md shadow-lg z-50 border border-neutral-200 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Searching...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No results found
            </div>
          ) : (
            <ul>
              {searchResults.map((result, index) => (
                <li
                  key={result.id}
                  className={`px-4 py-3 text-sm cursor-pointer hover:bg-neutral-50 flex flex-col ${
                    index === selectedIndex ? "bg-neutral-100" : ""
                  }`}
                  onClick={() => handleResultClick(result)}
                >
                  <div className="font-medium flex items-center gap-2">
                    <span>#{result.id}</span>
                    {result.status === "scheduled" && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                        Scheduled
                      </span>
                    )}
                    {result.status === "in-progress" && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        In Progress
                      </span>
                    )}
                    {result.status === "completed" && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                        Completed
                      </span>
                    )}
                    {result.status === "cancelled" && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center mt-1 text-neutral-700">
                    {result.facilityName && (
                      <div className="flex items-center mr-3">
                        <MapPin className="h-3 w-3 mr-1 text-neutral-400" />
                        <span className="truncate max-w-[150px]">
                          {result.facilityName}
                        </span>
                      </div>
                    )}
                    {result.appointmentTypeName && (
                      <div className="flex items-center mr-3">
                        <Calendar className="h-3 w-3 mr-1 text-neutral-400" />
                        <span>{result.appointmentTypeName}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1 text-neutral-400" />
                      <span>{formatScheduleTime(result)}</span>
                    </div>
                  </div>
                  <div className="text-neutral-500 mt-1">
                    {result.carrierName || result.customerName || ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}