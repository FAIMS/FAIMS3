import { Alert, Snackbar } from '@mui/material'
import { FC } from 'react'
interface AlertProps {
  isOpen: boolean
  handleClose: () => void
}

export const AlertError: FC<AlertProps> = (props: AlertProps) => {
  const { isOpen, handleClose } = props

  return (
    <Snackbar open={isOpen} autoHideDuration={2500} onClose={handleClose}>
      <Alert onClose={handleClose} severity='error' sx={{ width: '100%' }}>
        User denied geolocation access
      </Alert>
    </Snackbar>
  )
}
