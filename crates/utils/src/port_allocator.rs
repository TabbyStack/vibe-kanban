use std::net::TcpListener;

/// Represents a pair of allocated ports for a dev server
#[derive(Debug, Clone, Copy)]
pub struct AllocatedPorts {
    pub frontend: u16,
    pub backend: u16,
}

/// Allocate two free ports by binding to port 0 and reading the assigned ports.
///
/// The sockets are immediately dropped after allocation, so there's a small race window
/// before the dev server binds to them. This is acceptable for dev servers which typically
/// handle port conflicts gracefully.
pub fn allocate_dev_server_ports() -> std::io::Result<AllocatedPorts> {
    let frontend_listener = TcpListener::bind("127.0.0.1:0")?;
    let frontend_port = frontend_listener.local_addr()?.port();
    drop(frontend_listener);

    let backend_listener = TcpListener::bind("127.0.0.1:0")?;
    let backend_port = backend_listener.local_addr()?.port();
    drop(backend_listener);

    Ok(AllocatedPorts {
        frontend: frontend_port,
        backend: backend_port,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allocate_dev_server_ports_returns_unique_ports() {
        let ports = allocate_dev_server_ports().expect("Failed to allocate ports");

        // Ports should be in valid range
        assert!(ports.frontend > 0);
        assert!(ports.backend > 0);

        // Frontend and backend should be different
        assert_ne!(ports.frontend, ports.backend);
    }

    #[test]
    fn test_multiple_allocations_are_unique() {
        let ports1 = allocate_dev_server_ports().expect("Failed to allocate ports 1");
        let ports2 = allocate_dev_server_ports().expect("Failed to allocate ports 2");

        // Each allocation should get different ports (with high probability)
        // Note: This test could theoretically fail if the OS reassigns the same ports,
        // but that's extremely unlikely in practice
        assert!(
            ports1.frontend != ports2.frontend || ports1.backend != ports2.backend,
            "Expected different ports for different allocations"
        );
    }
}
