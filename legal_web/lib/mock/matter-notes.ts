export interface MatterNote {
  id: string
  matterId: string
  body: string
  authorId: string
  authorName: string
  createdAt: Date
}

const notes: MatterNote[] = []

export function getMatterNotes(matterId: string): MatterNote[] {
  return notes
    .filter((n) => n.matterId === matterId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function addMatterNote(
  matterId: string,
  body: string,
  authorId: string,
  authorName: string
): MatterNote {
  const note: MatterNote = {
    id: `mn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    matterId,
    body: body.trim(),
    authorId,
    authorName,
    createdAt: new Date(),
  }
  notes.push(note)
  return note
}
