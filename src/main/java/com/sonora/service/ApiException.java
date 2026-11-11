package com.sonora.service;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }

    public static ApiException notFound(String what) { return new ApiException(HttpStatus.NOT_FOUND, what + " not found"); }
    public static ApiException bad(String msg) { return new ApiException(HttpStatus.BAD_REQUEST, msg); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "You don't have access to this"); }
    public static ApiException unauthorized() { return new ApiException(HttpStatus.UNAUTHORIZED, "Sign in to continue"); }
}
