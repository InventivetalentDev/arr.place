module.exports = {
    apps: [{
        name: "canvas",
        script: "server.js",
        args: ["--color", "--time"],
        time: true,
        interpreter: "node@16.2.0",
        max_memory_restart: "300M"
    }]
}
