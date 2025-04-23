import bookingPagesRouter from './routes/bookingPages'
// …after you’ve done app.use(express.json()), etc.
app.use('/api/booking-pages', bookingPagesRouter)