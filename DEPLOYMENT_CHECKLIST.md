# Deployment Checklist ✅

## Pre-Deployment

- [ ] Review all code changes in `FIXES_SUMMARY.md`
- [ ] Ensure `.env` files are configured correctly
- [ ] Backup current production database
- [ ] Test all 8 fixes in staging environment
- [ ] Frontend build successful (`npm run build`)
- [ ] Backend dependencies installed (`npm install`)

---

## Deployment Steps

### Backend Deployment

- [ ] Pull deploy branch: `git checkout deploy && git pull origin deploy`
- [ ] Install dependencies: `cd backend && npm install`
- [ ] Configure production `.env`:
  - [ ] `NODE_ENV=production`
  - [ ] MongoDB connection string
  - [ ] JWT secrets configured
  - [ ] CryptoAPI credentials
  - [ ] External API tokens
- [ ] Test database connection
- [ ] Start backend: `pm2 start ecosystem.config.js` or `npm start`
- [ ] Verify backend health: `curl http://localhost:5000/api/health`

### Frontend Deployment

- [ ] Build production: `cd frontend && npm run build`
- [ ] Verify build output in `.next` directory
- [ ] Configure nginx/reverse proxy
- [ ] Start frontend: `pm2 start npm --name "frontend" -- start` or `npm run start`
- [ ] Verify frontend loads: Visit homepage

---

## Post-Deployment Testing

### Critical Path Tests

- [ ] **Homepage loads correctly**
- [ ] **Login works (test with mixed case email)**
- [ ] **Dashboard loads**
- [ ] **Sidebar shows correct menus**
  - [ ] Logo displays
  - [ ] Payment menu visibility matches config
  - [ ] Telegram link works

### Feature Tests

- [ ] **Checker Page**
  - [ ] Responsive on mobile (Chrome DevTools)
  - [ ] Card check functionality
  - [ ] Filter and export work
  
- [ ] **Crypto Payment**
  - [ ] Can create payment request
  - [ ] Check console logs (should show debug info)
  - [ ] No 401 errors
  
- [ ] **Admin Panel**
  - [ ] Can add credit to user
  - [ ] Can subtract credit from user
  - [ ] API tester loads
  - [ ] Test CryptoAPI endpoint works (not 404)

### Performance Tests

- [ ] **No 429 rate limit errors** (check logs)
- [ ] **Response times acceptable** (<2s for most requests)
- [ ] **No memory leaks** (monitor with `pm2 monit`)

---

## Monitoring

### Immediate (First Hour)

- [ ] Watch PM2 logs: `pm2 logs`
- [ ] Monitor error rates in application
- [ ] Check database connection stability
- [ ] Verify no authentication issues

### First 24 Hours

- [ ] Review rate limiting statistics
- [ ] Check user feedback
- [ ] Monitor server resource usage (CPU, RAM, disk)
- [ ] Verify all features working in production

### First Week

- [ ] Collect analytics data
- [ ] Review error logs
- [ ] Plan bug fixes if needed
- [ ] Document any issues found

---

## Rollback Plan

If critical issues occur:

### Quick Rollback
```bash
# 1. Switch to previous stable branch
git checkout update
git pull origin update

# 2. Rebuild frontend
cd frontend
npm run build

# 3. Restart services
pm2 restart all

# 4. Verify services are running
pm2 status
```

### Database Rollback
```bash
# Only if database schema changed
mongorestore --drop --uri="mongodb://..." /path/to/backup
```

---

## Known Issues & Workarounds

### 1. 401 Errors on Crypto Payment
**Symptom:** User gets 401 when creating crypto payment  
**Debug:** Check browser console for token logs  
**Workaround:** Clear localStorage and re-login  

### 2. Rate Limiting in Production
**Symptom:** 429 errors appear  
**Debug:** Check `NODE_ENV` is set to `production`  
**Workaround:** Limits are already high (1000/15min), may need adjustment  

### 3. Mixed Case Login
**Symptom:** Users can't login with uppercase email  
**Fix:** Already fixed in deploy branch  
**Verify:** Test login with `Test@Example.Com`  

---

## Success Criteria

Deployment is successful when:

✅ All 8 TODO items are verified working  
✅ No critical errors in logs  
✅ Users can login and use main features  
✅ Performance is acceptable  
✅ Rate limiting is not blocking legitimate users  
✅ Admin panel functions correctly  
✅ Mobile responsive works  

---

## Contact & Support

**If issues occur:**
1. Check PM2 logs: `pm2 logs`
2. Check backend logs: `tail -f backend/logs/error.log`
3. Review `FIXES_SUMMARY.md` for what changed
4. Use rollback plan if critical

**GitHub Repository:**  
https://github.com/HoangAnhDev1805/creditv2

**Branch:** deploy  
**Commit:** 3dbe76d (latest)

---

## Sign-Off

- [ ] All pre-deployment checks completed
- [ ] All deployment steps executed
- [ ] All post-deployment tests passed
- [ ] Monitoring in place
- [ ] Team notified of deployment

**Deployed By:** _________________  
**Date:** _________________  
**Time:** _________________  
**Status:** ⬜ Success  ⬜ Partial  ⬜ Rollback Required
