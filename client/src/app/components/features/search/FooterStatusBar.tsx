interface FooterStatusBarProps {
  recordCount: number;
  searchCriteria: string;
}

export function FooterStatusBar({ recordCount, searchCriteria }: FooterStatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[40px] bg-[#F5F5F5] border-t border-[#DDDDDD] flex items-center px-4 gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[#2264A0]">Records:</span>
        <span className="text-[#8C8C8C]">{recordCount}</span>
      </div>
      <div className="w-px h-5 bg-[#DDDDDD]" />
      <div className="flex items-center gap-2 flex-1">
        <span className="font-semibold text-[#2264A0]">Search:</span>
        <span className="text-[#8C8C8C] truncate">{searchCriteria || '(none)'}</span>
      </div>
    </div>
  );
}
