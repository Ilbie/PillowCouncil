import type { ChangeEvent, FC } from "react";
import { ChevronDown, Lightbulb, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UI_LOCALE_OPTIONS, type UiLocale, getUiCopy } from "@/lib/i18n";

type PillowCouncilHeaderProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  onOpenSettings: () => void;
  onUiLocaleChange: (locale: UiLocale) => void;
};

export const PillowCouncilHeader: FC<PillowCouncilHeaderProps> = ({ copy, uiLocale, onOpenSettings, onUiLocaleChange }) => {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-[#090d1a] px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.35)]">
          <Lightbulb className="text-white" size={16} />
        </div>
        <div className="flex items-center gap-2">
      <h1 className="text-lg font-bold tracking-tight text-gray-100">PillowCouncil</h1>

        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{copy.uiLanguageLabel}</span>
          <div className="relative w-28">
            <Select
              className="h-9 w-full appearance-none rounded-lg border-gray-700 bg-gray-800/90 py-1 pl-3 pr-8 text-xs text-gray-200"
              value={uiLocale}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onUiLocaleChange(event.target.value as UiLocale)}
            >
              {UI_LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
        <div className="h-5 w-px bg-gray-800" />
        <Button variant="ghost" size="sm" className="h-8 rounded-lg border border-gray-700 bg-gray-800/80 px-3 text-xs text-gray-300 hover:bg-gray-700 hover:text-white" onClick={onOpenSettings}>
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          {copy.connection.title}
        </Button>
      </div>
    </header>
  );
};

export default PillowCouncilHeader;
