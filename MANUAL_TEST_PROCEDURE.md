# Manual Testing Procedure - WebsiteSelector Loading Issue

## Setup

1. Open Chrome browser
2. Navigate to: http://localhost:3168/login
3. Open DevTools (F12 or Cmd+Option+I)

## Test Steps

### Step 1: Login

- Email: nelsonjou@gmail.com
- Password: aa123123
- Click "繼續"
- Wait for redirect to dashboard

### Step 2: Navigate to Articles

- Go to: http://localhost:3168/dashboard/articles
- Wait for page to load

### Step 3: Open DevTools Panels

- **Console**: Check for errors
- **Network**: Monitor API requests
- **Elements**: Inspect component state

### Step 4: Click Article

- Click on any article in the list
- Wait for right-side editor to load

### Step 5: Click Publish Button

- Click "發布" button in editor toolbar
- Observe dialog opening

### Step 6: Debug WebsiteSelector

#### Network Panel

- Filter by "website_configs"
- Count number of requests
- Check request/response timing
- Verify status codes (should be 200)

#### Console Panel

- Check for React errors
- Look for "Failed to fetch websites" errors
- Check for infinite loop warnings

#### Elements Panel (React DevTools)

1. Install React DevTools extension if not installed
2. Switch to "Components" tab
3. Find `WebsiteSelector` component
4. Inspect state:
   - `loading` - should be `false` after fetch
   - `websites` - should contain array of websites
   - `companyId` - should be set
5. Check hooks:
   - `hasFetchedRef.current` - should be `true` after first fetch
   - `hasSetDefaultRef.current` - should be `true` after setting default

#### Sources Panel - Set Breakpoints

1. Open Sources panel
2. Find: `src/components/articles/WebsiteSelector.tsx`
3. Set breakpoints at:
   - Line 97: `setLoading(false)`
   - Line 99-104: Default website selection logic
4. Reload and trigger publish again
5. When breakpoint hits:
   - Check `data` variable (should have websites)
   - Check `loading` state before and after setLoading(false)
   - Step through default selection logic

### Step 7: Identify Root Cause

Check these possibilities:

1. **Component Re-mounting**
   - Does the component unmount/remount when dialog opens?
   - Check if `hasFetchedRef` resets to false

2. **State Update Not Rendering**
   - Is `setLoading(false)` being called?
   - Is React batching the state update?
   - Is the component using stale state?

3. **Conditional Rendering Issue**
   - Is the loading check using the correct state?
   - Is there a race condition with async setState?

4. **Dialog Portal Issue**
   - Does the Select component render in a portal?
   - Is the loading state isolated per instance?

### Step 8: Solution

Based on findings, the fix might be:

- Move loading state to parent component
- Use a different approach for loading indicator
- Ensure `setLoading(false)` happens synchronously after data is set
- Add a delay or use useLayoutEffect instead of useEffect

## Expected Results

✅ **Working State:**

- 1 API request to website_configs
- `loading` state changes from `true` to `false`
- Websites populate the dropdown
- No console errors

❌ **Current Issue:**

- `loading` state stuck at `true`
- Select shows "載入中..." indefinitely
- Component may be re-fetching or re-mounting

## Quick Console Commands to Run

```javascript
// Check component mount count
let mountCount = 0;
const original = WebsiteSelector;
WebsiteSelector = function (...args) {
  console.log("WebsiteSelector mounted:", ++mountCount);
  return original.apply(this, args);
};

// Monitor loading state changes
let loadingStates = [];
const originalSetState = React.useState;
React.useState = function (initial) {
  const [state, setState] = originalSetState(initial);
  if (typeof initial === "boolean" && initial === true) {
    loadingStates.push(state);
    console.log("Loading state created:", state);
  }
  return [state, setState];
};
```
