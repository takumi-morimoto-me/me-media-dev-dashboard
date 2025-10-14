export interface FilterOption {
  value: string
  label: string
}

export const mediaFilterOptions: FilterOption[] = [
  { value: "all", label: "全社" },
  { value: "media-a", label: "メディアA" },
  { value: "media-b", label: "メディアB" },
]

export const fiscalYearOptions: FilterOption[] = [
  { value: "2025", label: "2025年度" },
  { value: "2024", label: "2024年度" },
]

export const monthOptions: FilterOption[] = [
  { value: "10", label: "10月" },
  { value: "9", label: "9月" },
  { value: "8", label: "8月" },
]
