{{/*
Ingress template.

TWO shapes are supported. The template picks the first one that has
values wired:

1. Explicit multi-host list — set `ingress.hosts:` in values.yaml:

     ingress:
       hosts:
         - host: www.example.com
           tlsSecret: tls-www-example-p
         - host: example.com
           tlsSecret: tls-example-p

   The chart renders ONE Ingress resource with per-host `rules[]` and
   per-host `tls[]` blocks so a single deployment fronts multiple
   canonical domains. Use for marketing-site + product-domain,
   www<->apex aliases, or transitional migrations.

   `seo.canonicalHost` is INDEPENDENT of this list — with multiple
   served hosts, one MUST be declared canonical or crawlers treat the
   copies as duplicate content.

2. Legacy jxRequirements single-host — the default when
   `ingress.hosts` is empty. Domain + namespaceSubDomain come from
   `jx-values.yaml` (auto-generated per cluster and per environment).
   Preview: jx preview create populates jx-values.yaml with the
   cluster's domain + namespaceSubDomain "-prN.". Staging: same
   pattern with "-jx-staging." Prod: "-jx-production."

Usage in chart templates/ingress.yaml:
  {{ include "leartech.ingress" . }}
*/}}

{{- define "leartech.ingress" -}}
{{- $gw := .Values.gateway | default dict -}}
{{- $global := .Values.global | default dict -}}
{{- $gwEnabled := false -}}
{{- if hasKey $global "gatewayAPIEnabled" }}{{- $gwEnabled = $global.gatewayAPIEnabled -}}{{- end -}}
{{- if hasKey $gw "enabled" }}{{- if $gw.enabled }}{{- $gwEnabled = true -}}{{- end -}}{{- end -}}
{{- if .Values.knativeDeploy }}
{{/* knative bypasses raw Ingress — nothing to render here. */}}
{{- else if $gwEnabled }}
{{/* Gateway API edge (Envoy): nginx is decommissioned, so an Ingress would
     404. Render an HTTPRoute attached to the shared envoy Gateway instead.
     Multi-host and single-host both map to HTTPRoute hostnames. */}}
{{ include "leartech.httproute" . }}
{{- else if gt (len (.Values.ingress.hosts | default list)) 0 }}
{{ include "leartech.ingress.multiHost" . }}
{{- else if .Values.jxRequirements.ingress.domain }}
{{ include "leartech.ingress.singleHost" . }}
{{- end }}
{{- end -}}

{{/* ---------- Gateway API HTTPRoute (Envoy) ---------- */}}
{{- define "leartech.httproute" -}}
{{- $gw := .Values.gateway | default dict -}}
{{- $backendName := include "leartech.fullname" . -}}
{{- $svcPort := .Values.service.externalPort | default 8080 -}}
{{- $hosts := list -}}
{{- if gt (len (.Values.ingress.hosts | default list)) 0 -}}
{{- range .Values.ingress.hosts }}{{- $hosts = append $hosts .host -}}{{- end -}}
{{- else -}}
{{- $single := printf "%s%s%s" (.Values.service.name | default (include "leartech.fullname" .)) .Values.jxRequirements.ingress.namespaceSubDomain .Values.jxRequirements.ingress.domain -}}
{{- $hosts = append $hosts $single -}}
{{- end -}}
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.service.name | default (include "leartech.fullname" .) }}
  labels:
    {{- include "leartech.labels" . | nindent 4 }}
    {{- with .Values.ingress.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  parentRefs:
  - name: {{ $gw.name | default "envoy-gateway" }}
    namespace: {{ $gw.namespace | default "envoy-gateway-system" }}
    sectionName: {{ $gw.sectionName | default "https" }}
  hostnames:
  {{- range $hosts }}
  - {{ . | quote }}
  {{- end }}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: "/"
    backendRefs:
    - name: {{ $backendName }}
      port: {{ $svcPort }}
{{- end -}}

{{/* ---------- Multi-host explicit-list Ingress ---------- */}}
{{- define "leartech.ingress.multiHost" -}}
{{- $hostName := .Values.service.name | default (include "leartech.fullname" .) }}
{{- $backendName := include "leartech.fullname" . }}
{{- $svcPort := .Values.service.externalPort | default 8080 }}
{{- $annotations := dict }}
{{- $_ := merge $annotations (.Values.ingress.annotations | default dict) }}
{{- if not (hasKey $annotations "kubernetes.io/ingress.class") }}
{{- $_ := set $annotations "kubernetes.io/ingress.class" (.Values.ingress.classAnnotation | default "nginx") }}
{{- end }}
apiVersion: {{ .Values.jxRequirements.ingress.apiVersion | default "networking.k8s.io/v1" }}
kind: Ingress
metadata:
  name: {{ $hostName }}
  labels:
    {{- include "leartech.labels" . | nindent 4 }}
    {{- with .Values.ingress.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- if $annotations }}
  annotations:
    {{- toYaml $annotations | nindent 4 }}
  {{- end }}
spec:
  rules:
  {{- range .Values.ingress.hosts }}
  - host: {{ .host }}
    http:
      paths:
      - path: /
        pathType: {{ $.Values.ingress.pathType | default "ImplementationSpecific" }}
        backend:
          service:
            name: {{ $backendName }}
            port:
              number: {{ $svcPort }}
  {{- end }}
  {{- $tlsHosts := list }}
  {{- range .Values.ingress.hosts }}
  {{- if .tlsSecret }}
  {{- $tlsHosts = append $tlsHosts . }}
  {{- end }}
  {{- end }}
  {{- if gt (len $tlsHosts) 0 }}
  tls:
  {{- range $tlsHosts }}
  - hosts:
    - {{ .host }}
    secretName: {{ .tlsSecret }}
  {{- end }}
  {{- end }}
{{- end -}}

{{/* ---------- Legacy single-host jxRequirements Ingress ---------- */}}
{{- define "leartech.ingress.singleHost" -}}
{{- $hostName := .Values.service.name | default (include "leartech.fullname" .) }}
{{- $backendName := include "leartech.fullname" . }}
{{- $svcPort := .Values.service.externalPort | default 8080 }}
{{- $annotations := dict }}
{{- $_ := merge $annotations (.Values.ingress.annotations | default dict) (.Values.jxRequirements.ingress.annotations | default dict) }}
{{- if not (hasKey $annotations "kubernetes.io/ingress.class") }}
{{- $_ := set $annotations "kubernetes.io/ingress.class" (.Values.ingress.classAnnotation | default "nginx") }}
{{- end }}
apiVersion: {{ .Values.jxRequirements.ingress.apiVersion | default "networking.k8s.io/v1" }}
kind: Ingress
metadata:
  name: {{ $hostName }}
  labels:
    {{- include "leartech.labels" . | nindent 4 }}
    {{- with .Values.ingress.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- if $annotations }}
  annotations:
    {{- toYaml $annotations | nindent 4 }}
  {{- end }}
spec:
  rules:
  - host: {{ $hostName }}{{ .Values.jxRequirements.ingress.namespaceSubDomain }}{{ .Values.jxRequirements.ingress.domain }}
    http:
      paths:
      - path: /
        pathType: {{ .Values.ingress.pathType | default "ImplementationSpecific" }}
        backend:
          service:
            name: {{ $backendName }}
            port:
              number: {{ $svcPort }}
{{- if .Values.jxRequirements.ingress.tls.enabled }}
  tls:
  - hosts:
    - {{ $hostName }}{{ .Values.jxRequirements.ingress.namespaceSubDomain }}{{ .Values.jxRequirements.ingress.domain }}
{{- if .Values.jxRequirements.ingress.tls.production }}
    secretName: "tls-{{ .Values.jxRequirements.ingress.domain | replace "." "-" }}-p"
{{- else }}
    secretName: "tls-{{ .Values.jxRequirements.ingress.domain | replace "." "-" }}-s"
{{- end }}
{{- end }}
{{- end -}}
