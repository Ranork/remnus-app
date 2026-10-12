/**
 * Most rows one bulk server action (`deletePages`, `moveRowsToDatabase`) handles. A larger
 * pick in the table/board selection is sent in chunks of this size. Kept out of the
 * `'use server'` file, which may only export async functions.
 */
export const BULK_ROWS_PER_CALL = 50;
