import { FileInput } from '@astryxdesign/core/FileInput'

interface Props {
  label: string
  onFiles: (files: File[]) => void
  accept?: string
  description?: string
  isDisabled?: boolean
  isLoading?: boolean
}

// Callers own the uploaded files or pending queue, so this field only picks the next batch.
export default function AttachmentPicker({ label, onFiles, accept, description, isDisabled, isLoading }: Props) {
  return <FileInput label={label} isLabelHidden placeholder={label} width="100%" isMultiple value={null} accept={accept}
    description={description} isDisabled={isDisabled} isLoading={isLoading}
    onChange={(files) => { if (files) onFiles(Array.isArray(files) ? files : [files]) }} />
}
