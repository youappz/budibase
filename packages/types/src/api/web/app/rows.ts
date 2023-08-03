import { SearchParams } from "../../../sdk"
import { Row } from "../../../documents"

export interface PatchRowRequest extends Row {
  _id: string
  _rev: string
  tableId: string
}

export interface PatchRowResponse extends Row {}

export interface SearchRowRequest extends SearchParams {}

export interface SearchRowResponse {
  rows: any[]
}
