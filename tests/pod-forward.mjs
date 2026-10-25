// Inside a pod container: forward 127.0.0.1:<port> to the Mac's Worker, so pages keep a localhost
// Host header (the Worker's local login shortcuts check for it). Usage: node tests/pod-forward.mjs 3132, or 3123:3132 to listen on 3123
import net from 'node:net';
const [listen, port = listen] = process.argv[2].split(':').map(Number);
net.createServer((c) => {
	const up = net.connect(port, 'host.containers.internal');
	c.pipe(up).pipe(c);
	up.on('error', () => c.destroy());
	c.on('error', () => up.destroy());
}).listen(listen, '127.0.0.1');
