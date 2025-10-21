"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";

// Types
interface Header {
  key: string;
  label: string;
}

interface AspRow {
  asp_id: string;
  asp_name: string;
}

interface AggregatedData {
  [aspId: string]: {
    [headerKey: string]: number;
  };
}

interface AspFinancialsTableProps {
  headers: Header[];
  rows: AspRow[];
  data: AggregatedData;
}

const formatNumber = (num: number) => new Intl.NumberFormat('ja-JP').format(num);

const DataRow: React.FC<{
  asp: AspRow;
  headers: Header[];
  data: AggregatedData;
}> = ({ asp, headers, data }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-background">
        <span>{asp.asp_name}</span>
      </TableCell>
      {headers.map(header => {
        const actual = data[asp.asp_id]?.[header.key] || 0;
        return (
          <TableCell key={header.key} className="text-right font-mono border-l whitespace-nowrap px-2">
            {formatNumber(actual)}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

export default function AspFinancialsTable({
  headers,
  rows,
  data,
}: AspFinancialsTableProps) {
  return (
    <div className="bg-background rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="w-[250px] min-w-[250px] sticky left-0 bg-background z-10 align-middle border-b">
              ASP
            </TableHead>
            {headers.map(header => (
              <TableHead key={header.key} className="text-center border-l font-bold">
                {header.label}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {headers.map(header => (
              <TableHead key={header.key} className="min-w-[100px] text-right font-normal text-xs border-l whitespace-nowrap px-2">
                実績
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(asp => (
            <DataRow
              key={asp.asp_id}
              asp={asp}
              headers={headers}
              data={data}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
