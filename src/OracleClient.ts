/* eslint-disable no-unused-vars */
import net, { Socket } from 'net';
import { uuid } from 'uuidv4';
import EventEmitter from 'events';

export default (options: any) => {
  //
  // Layer 1 - handle all the established connections, store
  // them in a map and emit corresponding events
  //
  const connections = new Map<string, Socket>();
  const emitter = new EventEmitter();

  // Handle all TCP connections same way, no matter
  // if it's incoming or outcoming, we're p2p
  const handleNewSocket = (socket: Socket) => {
    const connectionId: string = uuid();

    connections.set(connectionId, socket);
    emitter.emit('connect', connectionId);

    socket.on('close', () => {
      connections.delete(connectionId);
      emitter.emit('disconnect', connectionId);
    });

    socket.on('data', (data) => {
      try {
        emitter.emit('message', {
          connectionId,
          message: JSON.parse(data.toString()),
        });
      } catch (e) {
        // console.error(`Cannot parse message from peer`, data.toString())
      }
    });
  };

  // Create a server itself and make it able to handle
  // all new connections and put the to the connections map
  const server = net.createServer((socket) => {
    handleNewSocket(socket);
  });

  /**
   * A method to "raw" send data by the connection ID
   * intended to internal use only
   * @param connectionId
   * @param message
   */
  const _send = (connectionId: string, message: any) => {
    const socket = connections.get(connectionId);

    if (!socket) {
      throw new Error(
        `Attempt to send data to connection that does not exist ${connectionId}`
      );
    }

    socket.write(JSON.stringify(message));
  };

  /**
   * A method for the libabry consumer to
   * establish connection to other nodes
   * @param ip
   * @param port
   * @param cb
   */
  const connect = (ip: string, port: number, cb: () => void) => {
    const socket = new net.Socket();

    socket.connect(port, ip, () => {
      console.log('connecting:', ip, port);
      handleNewSocket(socket);
      cb();
    });

    // Return a disconnect function so you can
    // exclude the node from the list
    return (cb: any) => socket.destroy(cb);
  };

  // A method to actually start the server
  const listen = (port: number | undefined, cb: number | undefined) => {
    server.listen(port, '0.0.0.0', cb);
    console.log('P2P Server started on port:', port);

    return (cb: any) => server.close(cb);
  };

  // One method to close all open connections
  // and server itself
  const close = (cb: any) => {
    for (let [connectionId, socket] of connections) {
      socket.destroy();
    }

    server.close(cb);
  };

  //
  // Layer 2 - create Nodes, assign IDs, handshake
  // and keep neighbors in a collection
  //
  const NODE_ID = uuid();
  const neighbors = new Map<string, string>();

  const findNodeId = (connectionId: string) => {
    for (let [nodeId, $connectionId] of neighbors) {
      if (connectionId === $connectionId) {
        return nodeId;
      }
    }
  };

  emitter.on('connect', (connectionId) => {
    console.log('emitter conect', connectionId);
    _send(connectionId, { type: 'handshake', data: { nodeId: NODE_ID } });
  });

  emitter.on('message', ({ connectionId, message }) => {
    const { type, data }: { type: 'handshake' | 'message'; data: any } =
      message;
    console.log('emitter message', message);

    if (type === 'handshake') {
      const { nodeId } = data;

      neighbors.set(nodeId, connectionId);
      emitter.emit('node-connect', { nodeId });
    }

    if (type === 'message') {
      const nodeId = findNodeId(connectionId);

      // if (!nodeId) {
      //   oops
      // }

      emitter.emit('node-message', { nodeId, data });
    }
  });

  emitter.on('disconnect', (connectionId: string) => {
    const nodeId = findNodeId(connectionId);

    if (!nodeId) {
      throw new Error(
        'Cannot find nodeId associated with connectionId:' + connectionId
      );
    }

    neighbors.delete(nodeId);
    emitter.emit('node-disconnect', { nodeId });
  });

  const send = (nodeId: string, data: any) => {
    const connectionId = neighbors.get(nodeId);

    if (!connectionId) {
      throw new Error('connectionId not found: ' + connectionId);
    }

    _send(connectionId, { type: 'message', data });
  };

  //
  // Layer 3 - here we can actually send data OVER
  // other nodes by doing recursive broadcast
  //
  const alreadySeenMessages = new Set();

  const p2psend = (data: {
    id: string;
    ttl: number;
    type: 'broadcast' | 'dm';
    message: any;
    destination?: any;
    origin: string;
  }) => {
    if (data.ttl < 1) {
      return;
    }

    for (const $nodeId of neighbors.keys()) {
      send($nodeId, data);
      alreadySeenMessages.add(data.id);
    }
  };

  const broadcast = (
    message: any,
    id = uuid(),
    origin = NODE_ID,
    ttl = 1000
  ) => {
    p2psend({ id, ttl, type: 'broadcast', message, origin });
  };

  const direct = (
    destination: any,
    message: any,
    origin = NODE_ID,
    ttl = 10,
    id = uuid()
  ) => {
    p2psend({ id, ttl, type: 'dm', message, destination, origin });
  };

  emitter.on('node-message', ({ nodeId, data }) => {
    if (!alreadySeenMessages.has(data.id)) {
      if (data.type === 'broadcast') {
        emitter.emit('broadcast', {
          message: data.message,
          origin: data.origin,
        });
        broadcast(data.message, data.id, data.origin, data.ttl - 1);
      }

      if (data.type === 'dm') {
        if (data.destination === NODE_ID) {
          emitter.emit('dm', { origin: data.origin, message: data.message });
        } else {
          direct(
            data.destination,
            data.message,
            data.origin,
            data.ttl - 1,
            data.id
          );
        }
      }
    }
  });

  return {
    listen,
    connect,
    close,
    broadcast,
    direct,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    id: NODE_ID,
    neighbors: () => neighbors.keys(),
  };
};
