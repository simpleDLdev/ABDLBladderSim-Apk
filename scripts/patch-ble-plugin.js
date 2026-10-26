#!/usr/bin/env node
// v25: local patch for @capacitor-community/bluetooth-le (Android Device.kt), applied on postinstall and on every sync,
// so it survives `npm ci`. Idempotent. Makes the plugin connect like the vendor DryClip app:
//  - requestConnectionPriority(HIGH) right after STATE_CONNECTED, before service discovery
//  - NO MTU request (plugin default asks for 512 and only resolves connect after onMtuChanged)
//  - connect resolves once services are discovered
//  - a drop during connect rejects the connect at once (no hanging until timeout)
//  - stale callbacks from an old GATT object are closed and ignored
//  - disconnect() on a link that never came up closes the GATT at once; a disconnect timeout also closes it
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'node_modules', '@capacitor-community', 'bluetooth-le', 'android', 'src', 'main',
  'java', 'com', 'capacitorjs', 'community', 'plugins', 'bluetoothle', 'Device.kt');
const MARK = '// BSIM-V25-PATCH';
if (!fs.existsSync(file)) { console.log('[patch-ble] plugin not installed, skipping'); process.exit(0); }
let src = fs.readFileSync(file, 'utf8');
if (src.includes(MARK)) { console.log('[patch-ble] already patched'); process.exit(0); }
const edits = [
  [ // connected: priority HIGH first, then discovery. disconnected: ignore stale gatt, reject a pending connect.
`            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connectionState = STATE_CONNECTED
                // service discovery is required to use services
                Logger.debug(TAG, "Connected to GATT server. Starting service discovery.")
                val result = bluetoothGatt?.discoverServices()
                if (result != true) {
                    reject("connect", "Starting service discovery failed.")
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connectionState = STATE_DISCONNECTED`,
`            ${MARK}
            if (bluetoothGatt != null && gatt !== bluetoothGatt) {
                Logger.debug(TAG, "Ignoring callback from stale GATT (status $status, state $newState)")
                if (newState == BluetoothProfile.STATE_DISCONNECTED) { try { gatt.close() } catch (e: Exception) {} }
                return
            }
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connectionState = STATE_CONNECTED
                // Like the vendor app: HIGH connection priority right after connect, before service discovery.
                val prio = gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
                Logger.debug(TAG, "Connected (status $status). requestConnectionPriority(HIGH)=$prio. Starting service discovery.")
                val result = gatt.discoverServices()
                if (result != true) {
                    reject("connect", "Starting service discovery failed.")
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connectionState = STATE_DISCONNECTED
                reject("connect", "Disconnected while connecting (status $status).")
                reject("discoverServices", "Disconnected.")`],
  [ // no MTU request: resolve connect when services are discovered
`                resolve("discoverServices", "Services discovered.")
                if (connectCallOngoing()) {
                    // Try requesting a larger MTU. Maximally supported MTU will be selected.
                    requestMtu(REQUEST_MTU)
                }`,
`                resolve("discoverServices", "Services discovered.")
                ${MARK}: no MTU request (vendor app never asks); connect is done once services are known.
                resolve("connect", "Connected.")`],
  [ // disconnect: close at once if the link never came up; close on timeout too
`        bluetoothGatt?.disconnect()
        setTimeout(key, "Disconnection timeout.", timeout)
    }`,
`        ${MARK}: a GATT that is not connected gets no disconnect callback, so close it now
        if (connectionState != STATE_CONNECTED) {
            reject("connect", "Cancelled.")
            connectionState = STATE_DISCONNECTED
            try { bluetoothGatt?.disconnect() } catch (e: Exception) {}
            try { bluetoothGatt?.close() } catch (e: Exception) {}
            bluetoothGatt = null
            cleanupCallbacksHandlerThread()
            resolve(key, "Disconnected.")
            return
        }
        bluetoothGatt?.disconnect()
        val gattToClose = bluetoothGatt
        val handler = Handler(Looper.getMainLooper())
        timeoutQueue.add(TimeoutHandler(key, handler))
        handler.postDelayed({
            if (bluetoothGatt === gattToClose) {
                connectionState = STATE_DISCONNECTED
                try { gattToClose?.close() } catch (e: Exception) {}
                bluetoothGatt = null
                onDisconnect()
            }
            resolve(key, "Disconnected (closed after timeout).")
        }, timeout)
    }`],
  [ // connection timeout: only touch the GATT it belongs to (don't kill a newer attempt's thread)
`        handler.postDelayed({
            connectionState = STATE_DISCONNECTED
            gatt?.disconnect()
            gatt?.close()
            cleanupCallbacksHandlerThread()
            reject(key, message)
        }, timeout)`,
`        handler.postDelayed({
            ${MARK}: only tear down the GATT this timeout belongs to
            try { gatt?.disconnect() } catch (e: Exception) {}
            try { gatt?.close() } catch (e: Exception) {}
            if (bluetoothGatt === gatt) {
                connectionState = STATE_DISCONNECTED
                bluetoothGatt = null
                cleanupCallbacksHandlerThread()
            }
            reject(key, message)
        }, timeout)`],
];
for (const [a, b] of edits) {
  if (!src.includes(a)) { console.error('[patch-ble] anchor not found — plugin version changed? ' + a.split('\n')[0].trim()); process.exit(1); }
  src = src.replace(a, b);
}
fs.writeFileSync(file, src);
console.log('[patch-ble] Device.kt patched (no MTU, priority HIGH before discovery, clean close)');
