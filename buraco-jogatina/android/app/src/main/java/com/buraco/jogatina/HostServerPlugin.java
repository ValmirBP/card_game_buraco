package com.buraco.jogatina;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@CapacitorPlugin(name = "HostServer")
public class HostServerPlugin extends Plugin {
    private InnerServer server;
    private final Map<String, WebSocket> connections = new ConcurrentHashMap<>();
    private final AtomicLong nextId = new AtomicLong(1);

    @PluginMethod
    public void start(PluginCall call) {
        if (server != null) {
            call.resolve(statusPayload());
            return;
        }

        int port = call.getInt("port", 3001);
        CountDownLatch bound = new CountDownLatch(1);
        Exception[] failure = new Exception[1];

        InnerServer newServer = new InnerServer(new InetSocketAddress("0.0.0.0", port), bound, failure);
        newServer.setReuseAddr(true);
        newServer.start();

        try {

            if (!bound.await(4, TimeUnit.SECONDS)) {
                failure[0] = new Exception("tempo esgotado esperando o servidor iniciar");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            failure[0] = e;
        }

        if (failure[0] != null) {
            try {
                newServer.stop();
            } catch (Exception ignored) {

            }
            call.reject("Não foi possível iniciar o servidor: " + failure[0].getMessage(), failure[0]);
            return;
        }

        server = newServer;
        call.resolve(statusPayload());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopServer();
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        String connId = call.getString("connId");
        String data = call.getString("data");
        if (connId == null || data == null) {
            call.reject("connId e data são obrigatórios");
            return;
        }
        WebSocket ws = connections.get(connId);
        if (ws == null || !ws.isOpen()) {
            call.resolve();
            return;
        }
        try {
            ws.send(data);
        } catch (Exception e) {
            call.reject("Falha ao enviar: " + e.getMessage(), e);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusPayload());
    }

    private JSObject statusPayload() {
        JSObject ret = new JSObject();
        boolean running = server != null;
        ret.put("running", running);
        if (running) {
            ret.put("port", server.getPort());
            String address = localIpAddress();
            if (address != null) ret.put("address", address);
        }
        return ret;
    }

    private void stopServer() {
        if (server == null) return;
        try {
            server.stop(200);
        } catch (Exception ignored) {

        }
        server = null;
        connections.clear();
    }

    @Override
    protected void handleOnDestroy() {

        stopServer();
        super.handleOnDestroy();
    }

    private String localIpAddress() {
        String fallback = null;
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces != null && ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (!iface.isUp() || iface.isLoopback()) continue;
                boolean tunnelLike = iface.getName().matches("^(tun|tap|ppp|wg|rmnet|ccmni|radio).*");
                Enumeration<InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (!(addr instanceof Inet4Address) || addr.isLoopbackAddress()) continue;
                    if (!tunnelLike) return addr.getHostAddress();
                    if (fallback == null) fallback = addr.getHostAddress();
                }
            }
        } catch (Exception ignored) {

        }
        return fallback;
    }

    private class InnerServer extends WebSocketServer {
        private final CountDownLatch bound;
        private final Exception[] failure;

        InnerServer(InetSocketAddress address, CountDownLatch bound, Exception[] failure) {
            super(address);
            this.bound = bound;
            this.failure = failure;
        }

        @Override
        public void onStart() {
            bound.countDown();
        }

        @Override
        public void onOpen(WebSocket conn, ClientHandshake handshake) {
            String connId = "native-" + nextId.getAndIncrement();
            conn.setAttachment(connId);
            connections.put(connId, conn);
            JSObject data = new JSObject();
            data.put("connId", connId);
            notifyListeners("connectionOpen", data);
        }

        @Override
        public void onClose(WebSocket conn, int code, String reason, boolean remote) {
            String connId = conn.getAttachment();
            if (connId == null) return;
            connections.remove(connId);
            JSObject data = new JSObject();
            data.put("connId", connId);
            notifyListeners("connectionClosed", data);
        }

        @Override
        public void onMessage(WebSocket conn, String message) {
            String connId = conn.getAttachment();
            if (connId == null) return;
            JSObject data = new JSObject();
            data.put("connId", connId);
            data.put("data", message);
            notifyListeners("message", data);
        }

        @Override
        public void onError(WebSocket conn, Exception ex) {
            if (conn == null) {

                failure[0] = ex;
                bound.countDown();
            }
        }
    }
}
