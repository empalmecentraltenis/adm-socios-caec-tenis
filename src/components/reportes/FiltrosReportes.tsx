'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FiltrosReportesProps {
  onFilterChange: (filters: { search: string; minMeses: number }) => void;
}

export default function FiltrosReportes({ onFilterChange }: FiltrosReportesProps) {
  const [search, setSearch] = useState('');
  const [minMeses, setMinMeses] = useState(0);

  function handleSearchChange(value: string) {
    setSearch(value);
    onFilterChange({ search: value, minMeses });
  }

  function handleMinMesesChange(value: string) {
    const num = parseInt(value) || 0;
    setMinMeses(num);
    onFilterChange({ search, minMeses: num });
  }

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-[#FFCC00]" />
        <h3 className="text-white text-sm font-semibold">Filtros</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999999]" />
          <Input
            placeholder="Buscar por DNI o nombre..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] placeholder:text-[#666666]"
          />
        </div>
        <Select onValueChange={handleMinMesesChange} defaultValue="0">
          <SelectTrigger className="w-full sm:w-40 bg-[#2A2A2A] border-[#333333] text-[#CCCCCC]">
            <SelectValue placeholder="Meses adeudados" />
          </SelectTrigger>
          <SelectContent className="bg-[#1E1E1E] border-[#333333]">
            <SelectItem value="0" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
              Todos
            </SelectItem>
            <SelectItem value="1" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
              1+ meses
            </SelectItem>
            <SelectItem value="2" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
              2+ meses
            </SelectItem>
            <SelectItem value="3" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
              3+ meses
            </SelectItem>
            <SelectItem value="6" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
              6+ meses
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
