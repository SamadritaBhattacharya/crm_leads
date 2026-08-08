// Side-effect only — each import registers its ColumnType with the registry
// (TABLE_SPEC.md §7). Imported once, at the top of TanstackTable.tsx.
import "@/components/table/columnTypes/text";
import "@/components/table/columnTypes/email";
import "@/components/table/columnTypes/phone";
import "@/components/table/columnTypes/date";
import "@/components/table/columnTypes/enum";
import "@/components/table/columnTypes/number";
import "@/components/table/columnTypes/badge";
import "@/components/table/columnTypes/user";
import "@/components/table/columnTypes/link";
