import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatGbp } from "@/domain/money";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  brandBand: { backgroundColor: "#050505", borderRadius: 8, padding: 12, width: 190 },
  logo: { width: 166 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 22 },
  meta: { marginTop: 6, color: "#334155", textAlign: "right" },
  columns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  column: { width: "48%" },
  label: { fontSize: 8, color: "#64748b", marginBottom: 4, letterSpacing: 1 },
  strong: { fontSize: 12, marginBottom: 3 },
  line: { marginBottom: 2 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  description: { width: "46%" },
  amount: { width: "18%", textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  balance: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    fontSize: 12,
  },
  notes: { marginTop: 22 },
  footer: { marginTop: 28, color: "#64748b", fontSize: 9 },
});

export type InvoiceDocumentItem = {
  description: string;
  netPence: number;
  vatPence: number;
  grossPence: number;
};

export type InvoiceDocumentProps = {
  number: string;
  company: string;
  addressLines: string[];
  companyNumber: string | null;
  email: string;
  phone: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  customer: string;
  customerEmail: string | null;
  issued: string;
  due: string;
  notes: string | null;
  items: InvoiceDocumentItem[];
  netPence: number;
  vatPence: number;
  totalPence: number;
  paidPence: number;
  balancePence: number;
  logoPath?: string;
};

function AddressLine({ line }: { line: string }) {
  return <Text style={styles.line}>{line}</Text>;
}

function ItemRow({ item }: { item: InvoiceDocumentItem }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.amount}>{formatGbp(item.netPence)}</Text>
      <Text style={styles.amount}>{formatGbp(item.vatPence)}</Text>
      <Text style={styles.amount}>{formatGbp(item.grossPence)}</Text>
    </View>
  );
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const vatNotice = props.vatRegistered
    ? `VAT number ${props.vatNumber ?? "not recorded"}`
    : "Not VAT registered. This document is not a VAT invoice.";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBand}>
            {props.logoPath ? <PdfImage src={props.logoPath} style={styles.logo} /> : <Text style={styles.strong}>{props.company}</Text>}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.meta}>{props.number}</Text>
            <Text style={styles.meta}>Issued {props.issued}</Text>
            <Text style={styles.meta}>Due {props.due}</Text>
          </View>
        </View>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.label}>FROM</Text>
            <Text style={styles.strong}>{props.company}</Text>
            {props.addressLines.map((line) => (
              <AddressLine key={line} line={line} />
            ))}
            {props.companyNumber ? <Text style={styles.line}>Company number {props.companyNumber}</Text> : null}
            <Text style={styles.line}>{props.email}</Text>
            {props.phone ? <Text style={styles.line}>{props.phone}</Text> : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={styles.strong}>{props.customer}</Text>
            {props.customerEmail ? <Text style={styles.line}>{props.customerEmail}</Text> : null}
          </View>
        </View>
        <View style={styles.tableHead}>
          <Text style={styles.description}>Description</Text>
          <Text style={styles.amount}>Net</Text>
          <Text style={styles.amount}>VAT</Text>
          <Text style={styles.amount}>Amount</Text>
        </View>
        {props.items.map((item) => (
          <ItemRow key={`${item.description}-${item.grossPence}`} item={item} />
        ))}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Net</Text>
            <Text>{formatGbp(props.netPence)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>VAT</Text>
            <Text>{formatGbp(props.vatPence)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total</Text>
            <Text>{formatGbp(props.totalPence)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Paid</Text>
            <Text>{formatGbp(props.paidPence)}</Text>
          </View>
          <View style={styles.balance}>
            <Text>Balance due</Text>
            <Text>{formatGbp(props.balancePence)}</Text>
          </View>
        </View>
        {props.notes ? (
          <View style={styles.notes}>
            <Text style={styles.label}>NOTES</Text>
            <Text>{props.notes}</Text>
          </View>
        ) : null}
        <Text style={styles.footer}>{vatNotice}</Text>
      </Page>
    </Document>
  );
}
