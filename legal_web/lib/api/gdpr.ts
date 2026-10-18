import { apiFetch } from "./client"

export interface DeleteAccountResult {
  deleted: boolean
  subjectType: string
  subjectId: string
  deletedAt: string
}

export async function deleteMyAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  return apiFetch<DeleteAccountResult>("/gdpr/users/me/delete", {
    method: "POST",
    body: { confirmEmail },
  })
}
