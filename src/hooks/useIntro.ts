import { useEffect, useState } from 'react'

/**
 * True for the first `ms` after mount. Staggered pop-ins use it to drop their animation class
 * afterwards: iPhone Safari sometimes freezes a tile mid-pop (shrunk and see-through), and taking
 * the class away forces it back to its normal look.
 */
export function useIntro(ms = 1200) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(id)
  }, [ms])
  return on
}
