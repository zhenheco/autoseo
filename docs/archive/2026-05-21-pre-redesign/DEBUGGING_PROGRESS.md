# WebsiteSelector Debugging Progress

## Issue

Website selector stuck in "載入中..." (loading) state after clicking publish button

## Changes Made

### Fix 1: Removed `value` from useEffect dependencies

**Problem**: `value` changing triggered infinite loop
**Solution**: Removed `value` from dependencies array
**Result**: Reduced from 2 requests to 1 request ✅

### Fix 2: Added fetch guard with useRef

**Problem**: Component might be fetching multiple times
**Solution**: Added `hasFetchedRef` to prevent duplicate fetches
**Result**: Only 1 fetch happens ✅

### Fix 3: Added `setLoading(false)` on error

**Problem**: If fetch errors, loading state stays true
**Solution**: Call `setLoading(false)` in error handler
**Status**: Added ✅

### Fix 4: Added comprehensive debug logging

**Purpose**: Understand exact execution flow
**Logs Added**:

- `fetchWebsites called, hasFetched: ${bool}`
- `No user, aborting`
- `No membership, aborting`
- `Fetched websites: ${count} websites`
- `Set loading to false`
- `Setting default website: ${id}`
- `Rendering with loading: ${bool}, websites: ${count}`

## Current Status

✅ **Fixed**:

- Duplicate API requests (was 2, now 1)
- Infinite loop from onChange dependency
- Error handling sets loading to false

❌ **Still Broken**:

- Loading state persists as `true` after 3 seconds
- Component shows "載入中..." indefinitely

## Next Steps for Manual Testing

### Open Chrome DevTools and Test

1. **Navigate to**: http://localhost:3168/dashboard/articles
2. **Open DevTools**: Press F12
3. **Open Console tab**
4. **Click on an article** in the list
5. **Click "發布" button** in the editor
6. **Watch console logs** - you should see:

```
[WebsiteSelector] fetchWebsites called, hasFetched: false
[WebsiteSelector] Rendering with loading: true, websites: 0
[WebsiteSelector] Fetched websites: X websites
[WebsiteSelector] Set loading to false
[WebsiteSelector] Setting default website: xxx-xxx-xxx
[WebsiteSelector] Rendering with loading: false, websites: X
```

### Possible Scenarios

#### Scenario A: Fetch never completes

```
[WebsiteSelector] fetchWebsites called, hasFetched: false
[WebsiteSelector] Rendering with loading: true, websites: 0
// Nothing else
```

**Diagnosis**: Fetch is stuck or erroring silently
**Fix**: Check network tab for failed requests

#### Scenario B: setState not triggering re-render

```
[WebsiteSelector] fetchWebsites called, hasFetched: false
[WebsiteSelector] Rendering with loading: true, websites: 0
[WebsiteSelector] Fetched websites: 5 websites
[WebsiteSelector] Set loading to false
// No subsequent render with loading: false
```

**Diagnosis**: Component not re-rendering after setState
**Fix**: Component might be unmounting or parent blocking updates

#### Scenario C: Component re-mounting

```
[WebsiteSelector] fetchWebsites called, hasFetched: false
[WebsiteSelector] Rendering with loading: true, websites: 0
[WebsiteSelector] Fetched websites: 5 websites
[WebsiteSelector] Set loading to false
[WebsiteSelector] fetchWebsites called, hasFetched: false  // ← AGAIN
[WebsiteSelector] Rendering with loading: true, websites: 0
```

**Diagnosis**: Component unmounts and remounts, resetting state
**Fix**: Move state to parent or use key prop

#### Scenario D: Multiple instances

```
[WebsiteSelector] fetchWebsites called, hasFetched: false
[WebsiteSelector] Rendering with loading: true, websites: 0
[WebsiteSelector] fetchWebsites called, hasFetched: false  // ← Different instance
[WebsiteSelector] Rendering with loading: true, websites: 0
[WebsiteSelector] Fetched websites: 5 websites
[WebsiteSelector] Set loading to false
[WebsiteSelector] Rendering with loading: false, websites: 5  // ← Instance 1 updates
// But instance 2 stays loading: true
```

**Diagnosis**: Multiple selector instances, test checking wrong one
**Fix**: Ensure only one instance renders

## Expected Timeline

- **Manual test with Chrome**: 2-3 minutes
- **Identify scenario**: 1 minute
- **Apply fix**: 5-10 minutes
- **Verify fix**: 2 minutes

Total: ~15-20 minutes to resolution

## User Actions Required

Please open Chrome and follow the manual testing steps above. Share the console output so I can diagnose the exact issue.
